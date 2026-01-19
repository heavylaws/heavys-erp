#!/bin/bash
set -e

echo "🚀 Highway Cafe POS - Production Deployment"
echo "=============================================="

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to check system requirements
check_system_requirements() {
    log "Checking system requirements..."
    
    # Check available disk space (minimum 10GB)
    AVAILABLE_SPACE=$(df . | awk 'NR==2 {print $4}')
    REQUIRED_SPACE=10485760  # 10GB in KB
    
    if [ "$AVAILABLE_SPACE" -lt "$REQUIRED_SPACE" ]; then
        echo "❌ Insufficient disk space. Required: 10GB, Available: $(($AVAILABLE_SPACE/1024/1024))GB"
        exit 1
    fi
    
    # Check available memory (minimum 2GB)
    AVAILABLE_MEM=$(free | awk 'NR==2{print $7}')
    REQUIRED_MEM=2097152  # 2GB in KB
    
    if [ "$AVAILABLE_MEM" -lt "$REQUIRED_MEM" ]; then
        echo "⚠️  Warning: Low available memory. Recommended: 2GB, Available: $(($AVAILABLE_MEM/1024/1024))GB"
    fi
    
    log "✅ System requirements check passed"
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if running with sufficient privileges
    if [ "$EUID" -eq 0 ]; then
        echo "⚠️  Warning: Running as root. Consider using a non-root user with docker group access."
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker is not installed or not in PATH"
        echo "Install Docker using: curl -fsSL https://get.docker.com | sh"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        echo "❌ Docker Compose is not available"
        echo "Install Docker Compose plugin or standalone version"
        exit 1
    fi
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        echo "❌ Docker daemon is not running or not accessible"
        echo "Start Docker with: sudo systemctl start docker"
        echo "Add user to docker group: sudo usermod -aG docker \$USER"
        exit 1
    fi
    
    # Determine docker-compose command
    if command -v docker-compose &> /dev/null; then
        DOCKER_COMPOSE="docker-compose"
    else
        DOCKER_COMPOSE="docker compose"
    fi
    
    log "✅ Prerequisites check passed"
}

# Function to check required files
check_required_files() {
    log "Checking required files..."
    
    REQUIRED_FILES=(
        "Dockerfile.production"
        "docker-compose.production.yml"
        "package.json"
        "server/production.ts"
        "init-db.sql"
    )
    
    for file in "${REQUIRED_FILES[@]}"; do
        if [ ! -f "$file" ]; then
            echo "❌ Required file missing: $file"
            exit 1
        fi
    done
    
    log "✅ Required files check passed"
}

# Initialize checks
check_system_requirements
check_prerequisites
check_required_files

# Environment setup
setup_environment() {
    log "Setting up environment..."
    
    # Create .env file if it doesn't exist
    if [ ! -f ".env" ]; then
        log "Creating default .env file..."
        cat > .env << EOF
# Highway Cafe POS Production Environment
POSTGRES_PASSWORD=highway_cafe_secure_$(date +%s)
SESSION_SECRET=highway_cafe_session_$(openssl rand -hex 32)
NODE_ENV=production
DATABASE_TYPE=postgres
REPLIT_DEPLOYMENT=true
EOF
        log "✅ Environment file created. Please review and modify as needed."
    fi
}

# Stop and clean existing deployment
cleanup_existing() {
    log "Stopping existing containers..."
    $DOCKER_COMPOSE -f docker-compose.production.yml down --remove-orphans 2>/dev/null || true
    
    log "Cleaning up old containers and images..."
    docker system prune -f 2>/dev/null || true
    
    # Remove dangling volumes (but keep data volumes)
    docker volume prune -f 2>/dev/null || true
}

# Build and deploy
build_and_deploy() {
    log "Building Highway Cafe POS from scratch..."
    if ! $DOCKER_COMPOSE -f docker-compose.production.yml build --no-cache; then
        echo "❌ Build failed. Check the error messages above."
        exit 1
    fi
    
    log "Starting production deployment..."
    if ! $DOCKER_COMPOSE -f docker-compose.production.yml up -d; then
        echo "❌ Deployment failed. Check the error messages above."
        echo "Checking logs:"
        $DOCKER_COMPOSE -f docker-compose.production.yml logs --tail=20
        exit 1
    fi
}

# Execute deployment steps
setup_environment
cleanup_existing
build_and_deploy

# Wait for services to be ready and perform health checks
wait_for_services() {
    log "Waiting for services to initialize..."
    sleep 15
    
    # Check PostgreSQL first
    log "Checking database connectivity..."
    for i in {1..20}; do
        if $DOCKER_COMPOSE -f docker-compose.production.yml exec postgres pg_isready -U postgres >/dev/null 2>&1; then
            log "✅ Database is ready"
            break
        fi
        
        if [ $i -eq 20 ]; then
            echo "❌ Database failed to start"
            $DOCKER_COMPOSE -f docker-compose.production.yml logs postgres --tail=10
            exit 1
        fi
        
        sleep 2
    done
    
    # Check application health
    log "Checking application health..."
    for i in {1..30}; do
        if curl -s http://localhost:5000/health >/dev/null 2>&1; then
            log "✅ Highway Cafe POS is running successfully!"
            break
        fi
        
        if [ $((i % 5)) -eq 0 ]; then
            log "Still waiting for application to start... ($i/30)"
        fi
        
        if [ $i -eq 30 ]; then
            echo "❌ Application failed to start within 60 seconds"
            echo "Checking application logs:"
            $DOCKER_COMPOSE -f docker-compose.production.yml logs app --tail=20
            exit 1
        fi
        
        sleep 2
    done
}

# Display deployment results
show_deployment_info() {
    log "📱 Local access: http://localhost:5000"
    
    # Get network interface information
    echo "🌐 Network access from other devices:"
    
    # Try multiple methods to get IP addresses
    if command -v hostname >/dev/null 2>&1; then
        LOCAL_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
        if [ -n "$LOCAL_IP" ] && [ "$LOCAL_IP" != "127.0.0.1" ]; then
            echo "   Main IP: http://$LOCAL_IP:5000"
        fi
    fi
    
    # Try to get WiFi/Ethernet IP
    if command -v ip >/dev/null 2>&1; then
        WIFI_IP=$(ip route get 8.8.8.8 2>/dev/null | grep -oP 'src \K\S+' | head -1)
        if [ -n "$WIFI_IP" ] && [ "$WIFI_IP" != "127.0.0.1" ]; then
            echo "   Network IP: http://$WIFI_IP:5000"
        fi
    fi
    
    # Fallback: show interface info
    if command -v ifconfig >/dev/null 2>&1; then
        INTERFACE_IPS=$(ifconfig 2>/dev/null | grep -E "inet [0-9]" | grep -v "127.0.0.1" | awk '{print $2}' | head -3)
        for ip in $INTERFACE_IPS; do
            echo "   Interface: http://$ip:5000"
        done
    fi
    
    echo
    echo "🔑 Default Login Credentials:"
    echo "   Admin: admin / admin123"
    echo "   Manager: manager / manager123"
    echo "   Cashier: cashier / cashier123"
    echo "   Barista: barista / barista123"
    echo "   Courier: courier / courier123"
    echo
    echo "⚠️  SECURITY CRITICAL: Change all default passwords immediately!"
    echo
    
    # Show container status
    log "📊 Container Status:"
    $DOCKER_COMPOSE -f docker-compose.production.yml ps
    
    echo
    echo "🔧 Management Commands:"
    echo "   View logs: $DOCKER_COMPOSE -f docker-compose.production.yml logs -f"
    echo "   Stop services: $DOCKER_COMPOSE -f docker-compose.production.yml down"
    echo "   Restart: ./deploy-production.sh"
    echo "   Health check: curl http://localhost:5000/health"
    echo
    
    log "✅ Deployment completed successfully!"
    log "🎯 Highway Cafe POS is ready for production use"
}

# Execute health checks and display info
wait_for_services
show_deployment_info