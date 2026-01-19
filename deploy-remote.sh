#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Remote machine settings
REMOTE_USER="cox"
REMOTE_PASSWORD="2425"
REMOTE_DIR="/opt/highway-cafe-pos"

# Resolve remote host dynamically so we do not hard-code network-specific IPs
REMOTE_HOST_FILE="${REMOTE_HOST_FILE:-.remote-host}"
if [ -n "${REMOTE_HOST:-}" ]; then
    RESOLVED_REMOTE_HOST="$REMOTE_HOST"
elif [ -f "$REMOTE_HOST_FILE" ]; then
    RESOLVED_REMOTE_HOST=$(head -n1 "$REMOTE_HOST_FILE" | tr -d '\r\n\t ')
fi

if [ -z "${RESOLVED_REMOTE_HOST:-}" ]; then
    echo -e "${RED}Error: Remote host not specified.${NC}"
    echo "Set REMOTE_HOST env var or create $REMOTE_HOST_FILE with the hostname/IP before running."
    exit 1
fi

REMOTE_TARGET="$REMOTE_USER@$RESOLVED_REMOTE_HOST"

set -euo pipefail

# Check if sshpass is installed
if ! command -v sshpass &> /dev/null; then
    echo -e "${YELLOW}Installing sshpass...${NC}"
    sudo apt-get update && sudo apt-get install -y sshpass
fi

# Print step with color
print_step() {
    echo -e "${YELLOW}[DEPLOY]${NC} $1"
}

# Check if we can access the remote machine
print_step "Testing SSH connection to $REMOTE_TARGET..."
if ! sshpass -p "$REMOTE_PASSWORD" ssh -o StrictHostKeyChecking=no "$REMOTE_TARGET" exit; then
    echo -e "${RED}Error: Cannot connect to remote machine${NC}"
    echo "Please ensure:"
    echo "1. Remote machine is accessible at $RESOLVED_REMOTE_HOST"
    echo "2. Username and password are correct"
    exit 1
fi

LOCAL_IMAGE_TAG="highway-cafe-pos_app:latest"
IMAGE_TAR="/tmp/highway-cafe-pos-image.tar.gz"

print_step "Installing dependencies locally (npm ci)"
NODE_ENV=development npm ci

print_step "Building production assets (npm run build)"
npm run build

print_step "Building Docker image from compiled build (using dist/) -> $LOCAL_IMAGE_TAG"
BUILD_CTX=$(mktemp -d)
cp -r dist "$BUILD_CTX/"
cp package*.json "$BUILD_CTX/" 2>/dev/null || true
cp -r node_modules "$BUILD_CTX/" 2>/dev/null || true
cp -r migrations "$BUILD_CTX/" 2>/dev/null || true
cat > "$BUILD_CTX/Dockerfile" <<'DOCKERFILE'
FROM node:20-bullseye-slim
RUN apt-get update && apt-get install -y postgresql-client gzip && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY node_modules ./node_modules
COPY dist ./dist
COPY migrations ./migrations
EXPOSE 5000
CMD ["node","dist/index.cjs"]
DOCKERFILE

docker build -t "$LOCAL_IMAGE_TAG" "$BUILD_CTX"
rm -rf "$BUILD_CTX"

print_step "Saving Docker image to $IMAGE_TAR"
docker save "$LOCAL_IMAGE_TAG" | gzip > "$IMAGE_TAR"

print_step "Copying image to remote $REMOTE_TARGET:/home/$REMOTE_USER"
if ! sshpass -p "$REMOTE_PASSWORD" scp -o StrictHostKeyChecking=no "$IMAGE_TAR" "$REMOTE_TARGET:/home/$REMOTE_USER/"; then
    echo -e "${RED}Error: Failed to copy image to remote host${NC}"
    exit 1
fi

print_step "Copying docker-compose.production.yml to remote"
if ! sshpass -p "$REMOTE_PASSWORD" scp -o StrictHostKeyChecking=no docker-compose.production.yml "$REMOTE_TARGET:/opt/highway-cafe-pos/"; then
    echo -e "${RED}Error: Failed to copy docker-compose.production.yml${NC}"
    exit 1
fi

print_step "Deploying image on remote machine (load + restart service) ..."
sshpass -p "$REMOTE_PASSWORD" ssh -o StrictHostKeyChecking=no "$REMOTE_TARGET" bash -s "$REMOTE_USER" <<'REMOTE_EOF'
set -eu
REMOTE_USER="$1"
REMOTE_DIR="/opt/highway-cafe-pos"
IMAGE_TAR_REMOTE="/home/$REMOTE_USER/highway-cafe-pos-image.tar.gz"
BACKUP_DIR="$REMOTE_DIR/backups"
TIMESTAMP=$(date +%Y%m%d%H%M%S)

# IMPORTANT: Change to the correct directory to ensure docker-compose uses the right project name
cd "$REMOTE_DIR" || { echo "Failed to cd to $REMOTE_DIR"; exit 1; }

mkdir -p "$BACKUP_DIR"

echo "Backing up existing app files to $BACKUP_DIR/highway-cafe-pos-files-$TIMESTAMP.tar.gz"
tar -C /opt -czf "$BACKUP_DIR/highway-cafe-pos-files-$TIMESTAMP.tar.gz" --exclude=backups --exclude=node_modules highway-cafe-pos || true

echo "Stopping and removing app container if present"
docker compose -f docker-compose.production.yml stop app >/dev/null 2>&1 || true
docker compose -f docker-compose.production.yml rm -f app >/dev/null 2>&1 || true

echo "Loading Docker image"
gunzip -c "$IMAGE_TAR_REMOTE" | docker load || true

echo "Attempting to start app using existing docker-compose (no build)"
if docker compose -f docker-compose.production.yml up -d --no-build --remove-orphans --no-deps app; then
    echo "App started via docker compose successfully"
else
    echo "docker compose failed - will attempt manual container run attached to Postgres network"
    # Try to find the postgres container
    PG_CONTAINER=$(docker ps -a --filter "name=postgres" --format '{{.Names}}' | head -n 1)
    if [ -z "$PG_CONTAINER" ]; then
        PG_CONTAINER=$(docker ps -a --format '{{.Names}} {{.Image}}' | grep -i postgres | awk '{print $1}' | head -n1)
    fi
    if [ -z "$PG_CONTAINER" ]; then
        echo "Unable to find postgres container - aborting fallback"
        exit 1
    fi

    echo "Found Postgres container: $PG_CONTAINER"
    # Determine network of Postgres container
    PG_NETWORK=$(docker inspect --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' "$PG_CONTAINER" | awk '{print $1}')
    if [ -z "$PG_NETWORK" ]; then
        echo "Unable to determine network for Postgres - aborting"
        exit 1
    fi

    echo "Postgres network: $PG_NETWORK"
    # Extract POSTGRES_PASSWORD from Postgres container env
    PG_PASS=$(docker inspect --format '{{range $e := .Config.Env}}{{println $e}}{{end}}' "$PG_CONTAINER" | grep -E '^POSTGRES_PASSWORD=' | head -n1 | cut -d'=' -f2-)
    PG_PASS=${PG_PASS:-highway_cafe_2024}

    echo "Running database migrations..."
    if ! docker run --rm \
        --network "$PG_NETWORK" \
        -e DATABASE_URL="postgresql://postgres:${PG_PASS}@postgres:5432/highway_cafe" \
        -e POSTGRES_PASSWORD="$PG_PASS" \
        -e DB_HOST=postgres \
        -e DB_PORT=5432 \
        -e DB_NAME=highway_cafe \
        -e DB_USER=postgres \
        highway-cafe-pos_app:latest \
        node dist/migrate.cjs; then
            echo "Migration failed - aborting"
            exit 1
    fi

    echo "Running app container 'highway-cafe-pos_app' attached to network $PG_NETWORK"
    docker rm -f highway-cafe-pos_app >/dev/null 2>&1 || true
    docker run -d \
        --name highway-cafe-pos_app \
        --network "$PG_NETWORK" \
        -p 5000:5000 \
        -e NODE_ENV=production \
        -e COOKIE_SECURE=false \
        -e DATABASE_URL="postgresql://postgres:${PG_PASS}@postgres:5432/highway_cafe" \
        -e POSTGRES_PASSWORD="$PG_PASS" \
        -e POSTGRES_USER=postgres \
        -e DB_HOST=postgres \
        -e DB_PORT=5432 \
        -e DB_NAME=highway_cafe \
        -e DB_USER=postgres \
        -e ENABLE_VITE=false \
        -e REPLIT_DEPLOYMENT=true \
        -v app_logs:/app/logs \
        --restart unless-stopped \
        highway-cafe-pos_app:latest || {
            echo "Manual docker run failed - aborting"
            exit 1
        }
fi

echo "Deploy finished"
REMOTE_EOF

# Check if deploy was successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}Deployment completed successfully!${NC}"
    echo "Remote system has been updated and services restarted."
else
    echo -e "${RED}Deployment failed!${NC}"
    echo "Please check the error messages above."
    exit 1
fi