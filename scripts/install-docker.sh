#!/bin/bash
# Highway Cafe POS - Docker Installation Script
# Supports Ubuntu, Debian, CentOS, RHEL, Fedora

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}$1${NC}"
}

# Detect OS
detect_os() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        OS=$ID
        VER=$VERSION_ID
    else
        print_error "Cannot detect operating system"
        exit 1
    fi
}

# Check if running as root
check_privileges() {
    if [ "$EUID" -eq 0 ]; then
        print_warning "Running as root. This is not recommended for Docker installation."
        print_warning "Consider running as a regular user with sudo privileges."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Install Docker on Ubuntu/Debian
install_docker_ubuntu() {
    print_status "Installing Docker on Ubuntu/Debian..."
    
    # Update package index
    sudo apt-get update
    
    # Install prerequisites
    sudo apt-get install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Add Docker's official GPG key
    sudo mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/$OS/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    
    # Set up repository
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS \
        $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Update package index again
    sudo apt-get update
    
    # Install Docker Engine
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    print_status "Docker installed successfully on Ubuntu/Debian"
}

# Install Docker on CentOS/RHEL/Fedora
install_docker_centos() {
    print_status "Installing Docker on CentOS/RHEL/Fedora..."
    
    # Install prerequisites
    sudo dnf install -y dnf-plugins-core
    
    # Add Docker repository
    sudo dnf config-manager \
        --add-repo \
        https://download.docker.com/linux/$OS/docker-ce.repo
    
    # Install Docker Engine
    sudo dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    print_status "Docker installed successfully on CentOS/RHEL/Fedora"
}

# Install Docker using convenience script (fallback)
install_docker_script() {
    print_status "Installing Docker using convenience script..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm get-docker.sh
    print_status "Docker installed using convenience script"
}

# Configure Docker
configure_docker() {
    print_status "Configuring Docker..."
    
    # Start and enable Docker service
    sudo systemctl start docker
    sudo systemctl enable docker
    
    # Add current user to docker group
    if [ "$USER" != "root" ]; then
        sudo usermod -aG docker $USER
        print_warning "User $USER added to docker group"
        print_warning "You need to log out and back in for group changes to take effect"
    fi
    
    # Test Docker installation
    print_status "Testing Docker installation..."
    if sudo docker run --rm hello-world >/dev/null 2>&1; then
        print_status "Docker test successful"
    else
        print_error "Docker test failed"
        exit 1
    fi
}

# Install Docker Compose (if not included)
install_docker_compose() {
    if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
        print_status "Installing Docker Compose..."
        
        # Get latest version
        COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep -oP '"tag_name": "\K(.*)(?=")')
        
        # Download and install
        sudo curl -L "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose
        
        # Create symlink for convenience
        sudo ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
        
        print_status "Docker Compose installed successfully"
    else
        print_status "Docker Compose already available"
    fi
}

# Verify installation
verify_installation() {
    print_status "Verifying Docker installation..."
    
    # Check Docker version
    DOCKER_VERSION=$(docker --version)
    print_status "Docker version: $DOCKER_VERSION"
    
    # Check Docker Compose version
    if command -v docker-compose >/dev/null 2>&1; then
        COMPOSE_VERSION=$(docker-compose --version)
        print_status "Docker Compose version: $COMPOSE_VERSION"
    elif docker compose version >/dev/null 2>&1; then
        COMPOSE_VERSION=$(docker compose version)
        print_status "Docker Compose plugin version: $COMPOSE_VERSION"
    fi
    
    print_status "Docker installation verified successfully"
}

# Main installation function
main() {
    print_header "🐳 Highway Cafe POS - Docker Installation"
    print_header "=========================================="
    
    check_privileges
    detect_os
    
    print_status "Detected OS: $OS $VER"
    
    # Check if Docker is already installed
    if command -v docker >/dev/null 2>&1; then
        print_warning "Docker is already installed"
        docker --version
        read -p "Reinstall Docker? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            verify_installation
            exit 0
        fi
    fi
    
    # Install Docker based on OS
    case $OS in
        ubuntu|debian)
            install_docker_ubuntu
            ;;
        centos|rhel|fedora)
            install_docker_centos
            ;;
        *)
            print_warning "OS not specifically supported, trying convenience script"
            install_docker_script
            ;;
    esac
    
    configure_docker
    install_docker_compose
    verify_installation
    
    print_header ""
    print_header "✅ Docker Installation Complete!"
    print_header "================================"
    print_status "Next steps:"
    print_status "1. Log out and back in (or run 'newgrp docker')"
    print_status "2. Test with: docker run hello-world"
    print_status "3. Deploy Highway Cafe POS with: ./deploy-production.sh"
    print_header ""
}

# Run main function
main "$@"