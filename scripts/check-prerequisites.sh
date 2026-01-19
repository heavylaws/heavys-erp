#!/bin/bash
# Highway Cafe POS - Prerequisites Checker
# Comprehensive system requirements verification

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Status counters
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_TOTAL=0

# Function to print colored output
print_pass() {
    echo -e "${GREEN}✅ PASS${NC} $1"
    ((CHECKS_PASSED++))
}

print_fail() {
    echo -e "${RED}❌ FAIL${NC} $1"
    ((CHECKS_FAILED++))
}

print_warn() {
    echo -e "${YELLOW}⚠️  WARN${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ️  INFO${NC} $1"
}

print_header() {
    echo -e "${BLUE}=== $1 ===${NC}"
}

# Increment total checks
check() {
    ((CHECKS_TOTAL++))
}

# System requirements check
check_system_requirements() {
    print_header "System Requirements"
    
    # Check CPU cores
    check
    CPU_CORES=$(nproc)
    if [ "$CPU_CORES" -ge 2 ]; then
        print_pass "CPU cores: $CPU_CORES (minimum 2)"
    else
        print_fail "CPU cores: $CPU_CORES (minimum 2 required)"
    fi
    
    # Check total memory
    check
    TOTAL_MEM=$(free -m | awk 'NR==2{print $2}')
    if [ "$TOTAL_MEM" -ge 2048 ]; then
        print_pass "Total memory: ${TOTAL_MEM}MB (minimum 2048MB)"
    else
        print_fail "Total memory: ${TOTAL_MEM}MB (minimum 2048MB required)"
    fi
    
    # Check available memory
    check
    AVAILABLE_MEM=$(free -m | awk 'NR==2{print $7}')
    if [ "$AVAILABLE_MEM" -ge 1024 ]; then
        print_pass "Available memory: ${AVAILABLE_MEM}MB (minimum 1024MB)"
    else
        print_warn "Available memory: ${AVAILABLE_MEM}MB (minimum 1024MB recommended)"
        ((CHECKS_PASSED++)) # Count as pass with warning
    fi
    
    # Check disk space
    check
    AVAILABLE_SPACE=$(df . | awk 'NR==2 {print int($4/1024/1024)}')
    if [ "$AVAILABLE_SPACE" -ge 10 ]; then
        print_pass "Available disk space: ${AVAILABLE_SPACE}GB (minimum 10GB)"
    else
        print_fail "Available disk space: ${AVAILABLE_SPACE}GB (minimum 10GB required)"
    fi
    
    # Check operating system
    check
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        print_pass "Operating system: $PRETTY_NAME"
        print_info "OS details: $ID $VERSION_ID"
    else
        print_fail "Cannot detect operating system"
    fi
}

# Network requirements check
check_network_requirements() {
    print_header "Network Configuration"
    
    # Check if we can bind to port 5000
    check
    if netstat -tlnp 2>/dev/null | grep -q ":5000 "; then
        print_fail "Port 5000 is already in use"
        print_info "Stop the service using port 5000 or change the application port"
    else
        print_pass "Port 5000 is available"
    fi
    
    # Check network interfaces
    check
    INTERFACES=$(ip addr show | grep -E "inet [0-9]" | grep -v "127.0.0.1" | wc -l)
    if [ "$INTERFACES" -gt 0 ]; then
        print_pass "Network interfaces detected: $INTERFACES"
        print_info "Network addresses:"
        ip addr show | grep -E "inet [0-9]" | grep -v "127.0.0.1" | awk '{print "  " $2}' | head -3
    else
        print_warn "No external network interfaces found"
        ((CHECKS_PASSED++)) # Count as pass with warning
    fi
    
    # Check internet connectivity (optional)
    check
    if ping -c 1 8.8.8.8 >/dev/null 2>&1; then
        print_pass "Internet connectivity available"
    else
        print_warn "Internet connectivity not available (optional for operation)"
        ((CHECKS_PASSED++)) # Count as pass with warning
    fi
}

# Docker requirements check
check_docker_requirements() {
    print_header "Docker Requirements"
    
    # Check if Docker is installed
    check
    if command -v docker >/dev/null 2>&1; then
        DOCKER_VERSION=$(docker --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
        print_pass "Docker installed: $DOCKER_VERSION"
        
        # Check Docker version (minimum 20.10)
        check
        if [ "$(echo "$DOCKER_VERSION 20.10" | tr " " "\n" | sort -V | head -n1)" = "20.10" ]; then
            print_pass "Docker version is compatible (>= 20.10)"
        else
            print_fail "Docker version $DOCKER_VERSION is too old (minimum 20.10 required)"
        fi
        
        # Check if Docker daemon is running
        check
        if docker info >/dev/null 2>&1; then
            print_pass "Docker daemon is running"
        else
            print_fail "Docker daemon is not running or not accessible"
            print_info "Try: sudo systemctl start docker"
            print_info "Or add user to docker group: sudo usermod -aG docker \$USER"
        fi
        
        # Check user permissions
        check
        if docker info >/dev/null 2>&1; then
            print_pass "Docker permissions are correct"
        elif groups | grep -q docker; then
            print_warn "User is in docker group but needs to log out/in"
            ((CHECKS_PASSED++)) # Count as pass with warning
        else
            print_fail "User not in docker group"
            print_info "Add user to docker group: sudo usermod -aG docker \$USER"
        fi
        
    else
        print_fail "Docker is not installed"
        print_info "Install Docker with: curl -fsSL https://get.docker.com | sh"
        check # Docker version check
        print_fail "Docker version check skipped (Docker not installed)"
        check # Docker daemon check
        print_fail "Docker daemon check skipped (Docker not installed)"
        check # Docker permissions check
        print_fail "Docker permissions check skipped (Docker not installed)"
    fi
    
    # Check Docker Compose
    check
    if command -v docker-compose >/dev/null 2>&1; then
        COMPOSE_VERSION=$(docker-compose --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
        print_pass "Docker Compose installed: $COMPOSE_VERSION"
    elif docker compose version >/dev/null 2>&1; then
        COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "plugin")
        print_pass "Docker Compose plugin installed: $COMPOSE_VERSION"
    else
        print_fail "Docker Compose is not installed"
        print_info "Install with: sudo apt install docker-compose-plugin"
    fi
}

# Security requirements check
check_security_requirements() {
    print_header "Security Configuration"
    
    # Check firewall status
    check
    if command -v ufw >/dev/null 2>&1; then
        UFW_STATUS=$(sudo ufw status 2>/dev/null | head -1)
        if echo "$UFW_STATUS" | grep -q "Status: active"; then
            print_pass "Firewall (ufw) is active"
        else
            print_warn "Firewall (ufw) is not active"
            print_info "Enable with: sudo ufw enable"
            ((CHECKS_PASSED++)) # Count as pass with warning
        fi
    elif command -v firewall-cmd >/dev/null 2>&1; then
        if systemctl is-active --quiet firewalld; then
            print_pass "Firewall (firewalld) is active"
        else
            print_warn "Firewall (firewalld) is not active"
            ((CHECKS_PASSED++)) # Count as pass with warning
        fi
    else
        print_warn "No supported firewall detected"
        ((CHECKS_PASSED++)) # Count as pass with warning
    fi
    
    # Check if running as root
    check
    if [ "$EUID" -eq 0 ]; then
        print_warn "Running as root (not recommended for deployment)"
        print_info "Consider using a non-root user with sudo privileges"
        ((CHECKS_PASSED++)) # Count as pass with warning
    else
        print_pass "Running as non-root user"
    fi
    
    # Check sudo privileges
    check
    if sudo -n true 2>/dev/null; then
        print_pass "Sudo privileges available"
    else
        print_warn "Sudo privileges may be required"
        print_info "Some operations may prompt for password"
        ((CHECKS_PASSED++)) # Count as pass with warning
    fi
}

# Application files check
check_application_files() {
    print_header "Application Files"
    
    REQUIRED_FILES=(
        "package.json"
        "Dockerfile.production"
        "docker-compose.production.yml"
        "deploy-production.sh"
        "server/production.ts"
        "init-db.sql"
    )
    
    for file in "${REQUIRED_FILES[@]}"; do
        check
        if [ -f "$file" ]; then
            print_pass "Found: $file"
        else
            print_fail "Missing: $file"
        fi
    done
    
    # Check if deploy script is executable
    check
    if [ -x "deploy-production.sh" ]; then
        print_pass "Deploy script is executable"
    else
        print_warn "Deploy script is not executable"
        print_info "Make executable with: chmod +x deploy-production.sh"
        ((CHECKS_PASSED++)) # Count as pass with warning
    fi
}

# Optional dependencies check
check_optional_dependencies() {
    print_header "Optional Dependencies"
    
    # Check Git
    check
    if command -v git >/dev/null 2>&1; then
        GIT_VERSION=$(git --version | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')
        print_pass "Git installed: $GIT_VERSION"
    else
        print_warn "Git not installed (recommended for updates)"
        print_info "Install with: sudo apt install git"
        ((CHECKS_PASSED++)) # Count as pass with warning
    fi
    
    # Check curl
    check
    if command -v curl >/dev/null 2>&1; then
        print_pass "curl is available"
    else
        print_warn "curl not installed (required for health checks)"
        print_info "Install with: sudo apt install curl"
        ((CHECKS_PASSED++)) # Count as pass with warning
    fi
    
    # Check openssl (for session secrets)
    check
    if command -v openssl >/dev/null 2>&1; then
        print_pass "OpenSSL is available"
    else
        print_warn "OpenSSL not available (needed for secure session secrets)"
        ((CHECKS_PASSED++)) # Count as pass with warning
    fi
}

# Performance checks
check_performance() {
    print_header "Performance Metrics"
    
    # Check CPU speed
    check
    if [ -f /proc/cpuinfo ]; then
        CPU_MHZ=$(grep "cpu MHz" /proc/cpuinfo | head -1 | awk '{print int($4)}')
        if [ "$CPU_MHZ" -gt 2000 ]; then
            print_pass "CPU speed: ${CPU_MHZ}MHz (good)"
        else
            print_warn "CPU speed: ${CPU_MHZ}MHz (may be slow)"
            ((CHECKS_PASSED++)) # Count as pass with warning
        fi
    else
        print_info "Cannot determine CPU speed"
        ((CHECKS_PASSED++)) # Count as pass
    fi
    
    # Check storage type
    check
    ROOT_DEVICE=$(df / | tail -1 | awk '{print $1}')
    if lsblk -d -o name,rota | grep -E "$(basename "$ROOT_DEVICE")" | grep -q "0"; then
        print_pass "Storage: SSD detected (optimal)"
    else
        print_warn "Storage: HDD detected (SSD recommended)"
        ((CHECKS_PASSED++)) # Count as pass with warning
    fi
    
    # Check system load
    check
    LOAD_AVG=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
    LOAD_PERCENT=$(echo "$LOAD_AVG * 100 / $CPU_CORES" | bc -l 2>/dev/null || echo "0")
    if [ "$(echo "$LOAD_PERCENT < 50" | bc -l 2>/dev/null || echo "1")" = "1" ]; then
        print_pass "System load: ${LOAD_AVG} (normal)"
    else
        print_warn "System load: ${LOAD_AVG} (high)"
        ((CHECKS_PASSED++)) # Count as pass with warning
    fi
}

# Generate final report
generate_report() {
    print_header "Prerequisites Check Summary"
    
    echo
    printf "Total checks: %d\n" $CHECKS_TOTAL
    printf "${GREEN}Passed: %d${NC}\n" $CHECKS_PASSED
    printf "${RED}Failed: %d${NC}\n" $CHECKS_FAILED
    
    SUCCESS_RATE=$(( CHECKS_PASSED * 100 / CHECKS_TOTAL ))
    printf "Success rate: %d%%\n" $SUCCESS_RATE
    echo
    
    if [ $CHECKS_FAILED -eq 0 ]; then
        print_header "✅ ALL CHECKS PASSED"
        print_info "System is ready for Highway Cafe POS deployment"
        print_info "Run: ./deploy-production.sh"
    elif [ $SUCCESS_RATE -ge 80 ]; then
        print_header "⚠️  MOSTLY READY"
        print_info "System is mostly ready with some warnings"
        print_info "Review warnings above and proceed if acceptable"
        print_info "Run: ./deploy-production.sh"
    else
        print_header "❌ NOT READY"
        print_info "System has critical issues that need to be resolved"
        print_info "Fix the failed checks before deployment"
    fi
    
    echo
    print_info "For detailed setup instructions, see: SETUP-GUIDE.md"
    print_info "For deployment help, see: DEPLOYMENT.md"
}

# Main function
main() {
    echo -e "${BLUE}🔍 Highway Cafe POS - Prerequisites Checker${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo
    
    check_system_requirements
    echo
    check_network_requirements
    echo
    check_docker_requirements
    echo
    check_security_requirements
    echo
    check_application_files
    echo
    check_optional_dependencies
    echo
    check_performance
    echo
    generate_report
}

# Run main function
main "$@"