#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Remote machine settings
REMOTE_USER="cox"
REMOTE_IP="192.168.1.104"
REMOTE_DIR="/opt/highway-cafe-pos"
REMOTE_PASS="2425"

# Function to run remote command and print output
run_remote_cmd() {
    sshpass -p "$REMOTE_PASS" ssh -o StrictHostKeyChecking=no "$REMOTE_USER@$REMOTE_IP" "$1"
}

echo -e "${YELLOW}[CHECK]${NC} Checking remote system configuration..."

# Check if Docker is running
echo -e "\n${YELLOW}[CHECK]${NC} Checking Docker status..."
if run_remote_cmd "docker ps" > /dev/null 2>&1; then
    echo -e "${GREEN}Docker is running${NC}"
    echo "Running containers:"
    run_remote_cmd "docker ps"
else
    echo -e "${RED}Docker is not running or not installed${NC}"
fi

# Check application location and setup
echo -e "\n${YELLOW}[CHECK]${NC} Checking application installation..."
if run_remote_cmd "[ -d $REMOTE_DIR ]"; then
    echo -e "${GREEN}Application directory exists at $REMOTE_DIR${NC}"
    echo "Current version info:"
    run_remote_cmd "cd $REMOTE_DIR && git log -1"
else
    echo -e "${RED}Application directory not found at $REMOTE_DIR${NC}"
fi

# Create backup of the entire application directory and database
echo -e "\n${YELLOW}[CHECK]${NC} Creating backup of remote application..."

# Get timestamp for backup files
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory locally
mkdir -p backups

# Create application backup
echo "Creating application backup..."
run_remote_cmd "cd $REMOTE_DIR && tar -czf /tmp/app_backup_$TIMESTAMP.tar.gz ."
sshpass -p "$REMOTE_PASS" scp "$REMOTE_USER@$REMOTE_IP:/tmp/app_backup_$TIMESTAMP.tar.gz" "backups/"
run_remote_cmd "rm /tmp/app_backup_$TIMESTAMP.tar.gz"

# Check if PostgreSQL is installed and create database backup
echo "Checking PostgreSQL and creating database backup..."
if run_remote_cmd "command -v psql" > /dev/null 2>&1; then
    echo -e "${GREEN}PostgreSQL is installed${NC}"
    run_remote_cmd "PGPASSWORD=postgres pg_dump -U postgres cafe > /tmp/db_backup_$TIMESTAMP.sql"
    sshpass -p "$REMOTE_PASS" scp "$REMOTE_USER@$REMOTE_IP:/tmp/db_backup_$TIMESTAMP.sql" "backups/"
    run_remote_cmd "rm /tmp/db_backup_$TIMESTAMP.sql"
    echo -e "${GREEN}Database backup created${NC}"
else
    echo -e "${RED}PostgreSQL is not installed${NC}"
fi

echo -e "\n${GREEN}Backups have been created in the backups directory:${NC}"
ls -l backups/app_backup_$TIMESTAMP.tar.gz 2>/dev/null || echo "- No application backup created"
ls -l backups/db_backup_$TIMESTAMP.sql 2>/dev/null || echo "- No database backup created"

# Check Node.js and npm versions
echo -e "\n${YELLOW}[CHECK]${NC} Checking Node.js environment..."
run_remote_cmd "node -v && npm -v"

echo -e "\n${GREEN}Pre-deployment check complete!${NC}"