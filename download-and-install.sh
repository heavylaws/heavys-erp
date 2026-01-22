#!/bin/bash
# ============================================================================
# HEAVYS ERP - LUBUNTU/UBUNTU SERVER INSTALLER
# ============================================================================
# One-liner install:
#   curl -fsSL https://raw.githubusercontent.com/heavylaws/heavys-erp/main/download-and-install.sh | sudo bash
#
# Or download and run manually:
#   wget https://raw.githubusercontent.com/heavylaws/heavys-erp/main/download-and-install.sh
#   chmod +x download-and-install.sh
#   sudo ./download-and-install.sh
# ============================================================================

set -euo pipefail

# ============================================================================
# CONFIGURATION - Modify these as needed
# ============================================================================
APP_NAME="Heavys ERP"
APP_USER="heavys"
INSTALL_DIR="/opt/heavys-erp"
LOG_DIR="/var/log/heavys-erp"
GIT_REPO="https://github.com/heavylaws/heavys-erp.git"
GIT_BRANCH="main"
NODE_VERSION="20"
DB_NAME="heavys_erp"
DB_USER="heavys"
DB_PASS="heavys123"  # Change this in production!
APP_PORT="5000"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Please run as root: sudo $0"
        exit 1
    fi
}

print_banner() {
    echo ""
    echo "============================================"
    echo "   $APP_NAME - Server Installer"
    echo "============================================"
    echo ""
    log_info "Install Directory: $INSTALL_DIR"
    log_info "Service User: $APP_USER"
    log_info "Database: $DB_NAME"
    log_info "Port: $APP_PORT"
    echo ""
}

# ============================================================================
# STEP 1: Install System Dependencies
# ============================================================================
install_dependencies() {
    log_info "[1/7] Installing system dependencies..."
    
    apt-get update -qq
    
    # Install essential packages
    apt-get install -y -qq \
        curl \
        wget \
        git \
        build-essential \
        postgresql \
        postgresql-contrib \
        ufw \
        > /dev/null 2>&1
    
    # Install Node.js if not present or wrong version
    if ! command -v node &> /dev/null || [[ ! "$(node -v)" =~ ^v${NODE_VERSION} ]]; then
        log_info "Installing Node.js ${NODE_VERSION}..."
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - > /dev/null 2>&1
        apt-get install -y -qq nodejs > /dev/null 2>&1
    fi
    
    log_success "Dependencies installed successfully"
    log_info "  Node.js: $(node -v)"
    log_info "  npm: $(npm -v)"
    log_info "  PostgreSQL: $(psql --version | head -n1)"
}

# ============================================================================
# STEP 2: Create Application User and Directories
# ============================================================================
create_user_and_dirs() {
    log_info "[2/7] Setting up user and directories..."
    
    # Create application user if not exists
    if ! id "$APP_USER" &>/dev/null; then
        useradd -r -m -s /bin/bash "$APP_USER"
        log_info "Created user: $APP_USER"
    else
        log_info "User $APP_USER already exists"
    fi
    
    # Create directories
    mkdir -p "$INSTALL_DIR"
    mkdir -p "$LOG_DIR"
    mkdir -p "$INSTALL_DIR/backups"
    
    # Set ownership
    chown -R "$APP_USER:$APP_USER" "$INSTALL_DIR"
    chown -R "$APP_USER:$APP_USER" "$LOG_DIR"
    
    log_success "Directories created"
}

# ============================================================================
# STEP 3: Setup PostgreSQL Database
# ============================================================================
setup_database() {
    log_info "[3/7] Setting up PostgreSQL database..."
    
    # Ensure PostgreSQL is running
    systemctl start postgresql
    systemctl enable postgresql
    
    # Create database user and database
    sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" | grep -q 1 || \
        sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
    
    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" | grep -q 1 || \
        sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
    
    sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    
    log_success "Database configured: $DB_NAME"
}

# ============================================================================
# STEP 4: Clone or Update Repository
# ============================================================================
clone_repository() {
    log_info "[4/7] Downloading application..."
    
    if [ -d "$INSTALL_DIR/.git" ]; then
        log_info "Updating existing installation..."
        cd "$INSTALL_DIR"
        sudo -u "$APP_USER" git fetch origin
        sudo -u "$APP_USER" git reset --hard origin/$GIT_BRANCH
    else
        log_info "Cloning repository..."
        rm -rf "$INSTALL_DIR"/*
        sudo -u "$APP_USER" git clone -b "$GIT_BRANCH" "$GIT_REPO" "$INSTALL_DIR"
    fi
    
    log_success "Application downloaded"
}

# ============================================================================
# STEP 5: Install npm Dependencies and Build
# ============================================================================
build_application() {
    log_info "[5/7] Building application (this may take a few minutes)..."
    
    cd "$INSTALL_DIR"
    
    # Install dependencies
    sudo -u "$APP_USER" npm ci --omit=dev --silent 2>/dev/null || \
        sudo -u "$APP_USER" npm install --omit=dev --silent
    
    # Build the application
    sudo -u "$APP_USER" npm run build --silent 2>/dev/null || {
        log_warn "Build command not found, attempting manual build..."
        sudo -u "$APP_USER" npx vite build --silent 2>/dev/null || true
        sudo -u "$APP_USER" npx esbuild server/production.ts --bundle --platform=node --outfile=dist/production.cjs --format=cjs 2>/dev/null || true
    }
    
    log_success "Application built"
}

# ============================================================================
# STEP 6: Configure Environment
# ============================================================================
configure_environment() {
    log_info "[6/7] Configuring environment..."
    
    # Create .env file
    cat > "$INSTALL_DIR/.env" << EOF
# Heavys ERP Configuration
# Generated on $(date)

# Server Configuration
PORT=$APP_PORT
HOST=0.0.0.0
NODE_ENV=production

# Database Configuration
DATABASE_URL=postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME

# Session Security - CHANGE THIS IN PRODUCTION!
SESSION_SECRET=$(openssl rand -hex 32)

# Auth
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123

# Misc
SESSION_MAX_AGE=86400000
SESSION_ROLLING=true
EOF

    chown "$APP_USER:$APP_USER" "$INSTALL_DIR/.env"
    chmod 600 "$INSTALL_DIR/.env"
    
    log_success "Environment configured"
}

# ============================================================================
# STEP 7: Setup Systemd Service
# ============================================================================
setup_service() {
    log_info "[7/7] Setting up systemd service for auto-startup..."
    
    # Copy service file
    cat > /etc/systemd/system/heavys-erp.service << 'EOF'
[Unit]
Description=Heavys ERP - Point of Sale System
Documentation=https://github.com/heavylaws/heavys-erp
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=heavys
Group=heavys
WorkingDirectory=/opt/heavys-erp

# Main process
ExecStart=/usr/bin/node dist/index.cjs
ExecReload=/bin/kill -HUP $MAINPID

# Restart policy
Restart=always
RestartSec=10
StartLimitIntervalSec=60
StartLimitBurst=3

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=heavys-erp

# Environment
Environment=NODE_ENV=production
Environment=PORT=5000
EnvironmentFile=-/opt/heavys-erp/.env

# Security hardening
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

    # Update service file with correct user
    sed -i "s/User=heavys/User=$APP_USER/g" /etc/systemd/system/heavys-erp.service
    sed -i "s/Group=heavys/Group=$APP_USER/g" /etc/systemd/system/heavys-erp.service
    
    # Reload systemd and enable service
    systemctl daemon-reload
    systemctl enable heavys-erp
    
    log_success "Systemd service configured and enabled"
}

# ============================================================================
# STEP 8: Initialize Database and Start Service
# ============================================================================
start_service() {
    log_info "Initializing database schema..."
    
    cd "$INSTALL_DIR"
    
    # Run database migrations/push
    sudo -u "$APP_USER" npm run db:push 2>/dev/null || {
        log_warn "db:push not available, database may need manual setup"
    }
    
    log_info "Starting Heavys ERP service..."
    systemctl start heavys-erp
    
    # Wait for service to start
    sleep 3
    
    if systemctl is-active --quiet heavys-erp; then
        log_success "Service started successfully!"
    else
        log_warn "Service may have issues. Check logs with: journalctl -u heavys-erp -f"
    fi
}

# ============================================================================
# STEP 9: Configure Firewall
# ============================================================================
configure_firewall() {
    log_info "Configuring firewall..."
    
    # Enable UFW if not already enabled
    ufw --force enable > /dev/null 2>&1 || true
    
    # Allow SSH (important!)
    ufw allow ssh > /dev/null 2>&1 || true
    
    # Allow application port
    ufw allow $APP_PORT > /dev/null 2>&1 || true
    
    log_success "Firewall configured (port $APP_PORT open)"
}

# ============================================================================
# PRINT COMPLETION SUMMARY
# ============================================================================
print_summary() {
    echo ""
    echo "============================================"
    echo -e "${GREEN}   INSTALLATION COMPLETE!${NC}"
    echo "============================================"
    echo ""
    echo "Application URL: http://$(hostname -I | awk '{print $1}'):$APP_PORT"
    echo ""
    echo "Default Login:"
    echo "  Username: admin"
    echo "  Password: admin123"
    echo ""
    echo "Service Management Commands:"
    echo "  sudo systemctl status heavys-erp   # Check status"
    echo "  sudo systemctl restart heavys-erp  # Restart"
    echo "  sudo systemctl stop heavys-erp     # Stop"
    echo "  sudo journalctl -u heavys-erp -f   # View logs"
    echo ""
    echo "The service will start automatically on boot."
    echo ""
    echo -e "${YELLOW}IMPORTANT: Change default passwords in production!${NC}"
    echo "  - Edit /opt/heavys-erp/.env"
    echo "  - Update admin password via web interface"
    echo ""
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================
main() {
    check_root
    print_banner
    
    install_dependencies
    create_user_and_dirs
    setup_database
    clone_repository
    build_application
    configure_environment
    setup_service
    start_service
    configure_firewall
    
    print_summary
}

# Run main function
main "$@"
