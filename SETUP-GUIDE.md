# Highway Cafe POS - Complete Setup Guide

This guide provides step-by-step instructions for setting up the Highway Cafe POS system on different platforms with all prerequisites and requirements covered.

## 📋 Pre-Deployment Checklist

Before starting any deployment, ensure you have:

### System Requirements Met
- [ ] **Server Hardware**: 2+ CPU cores, 4GB+ RAM, 20GB+ SSD storage
- [ ] **Network Setup**: Local WiFi network with static IP configuration
- [ ] **Administrative Access**: Root/sudo on Linux, Administrator on Windows
- [ ] **Internet Connection**: For initial setup and downloads only

### Required Software Downloads
- [ ] **Docker & Docker Compose**: Latest versions installed
- [ ] **Git**: For repository cloning (optional but recommended)
- [ ] **Modern Browser**: Chrome 90+, Firefox 88+, or Edge 90+

### Database Prerequisites
- [ ] **PostgreSQL 15+**: Included in Docker setup (recommended)
- [ ] **Database Credentials**: Secure passwords prepared
- [ ] **Backup Storage**: External backup location configured

## 🐳 Docker Deployment (Recommended)

### Step 1: Install Docker

**Ubuntu/Debian:**
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose (if not included)
sudo apt install docker-compose-plugin

# Log out and back in, then test
docker --version
docker compose version
```

**CentOS/RHEL/Fedora:**
```bash
# Install Docker
sudo dnf install docker docker-compose

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER

# Test installation
docker --version
```

**Windows 11:**
```powershell
# Download and install Docker Desktop
# https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe

# Enable WSL2 integration if prompted
# Restart computer after installation

# Test installation
docker --version
docker compose version
```

### Step 2: Deploy Application

**Linux/macOS:**
```bash
# Clone repository
git clone <repository-url> highway-cafe-pos
cd highway-cafe-pos

# Make script executable
chmod +x deploy-production.sh

# Deploy application
./deploy-production.sh

# Verify deployment
curl http://localhost:5000/health
```

**Windows:**
```powershell
# Clone repository
git clone <repository-url> highway-cafe-pos
cd highway-cafe-pos

# Deploy application
.\deploy-production.ps1

# Verify deployment
Invoke-WebRequest http://localhost:5000/health
```

### Step 3: Configure Network Access

**Get Server IP Address:**
```bash
# Linux
hostname -I | awk '{print $1}'

# Windows
ipconfig | findstr "IPv4"

# macOS
ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}'
```

**Configure Firewall:**
```bash
# Ubuntu/Debian
sudo ufw allow 5000
sudo ufw enable

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=5000/tcp
sudo firewall-cmd --reload

# Windows (Run as Administrator)
netsh advfirewall firewall add rule name="Highway Cafe POS" dir=in action=allow protocol=TCP localport=5000
```

## 🖥️ Native Installation

### Ubuntu 20.04+ Native Setup

**Step 1: Install Prerequisites**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Install additional tools
sudo apt install git curl build-essential
```

**Step 2: Configure Database**
```bash
# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << EOF
CREATE DATABASE highway_cafe;
CREATE USER highway_cafe_user WITH ENCRYPTED PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE highway_cafe TO highway_cafe_user;
\q
EOF

# Test database connection
sudo -u postgres psql -d highway_cafe -c "SELECT version();"
```

**Step 3: Deploy Application**
```bash
# Clone repository
git clone <repository-url> highway-cafe-pos
cd highway-cafe-pos

# Install dependencies
npm ci --production

# Create environment file
cp .env.example .env

# Edit environment variables
nano .env
# Set: DATABASE_URL=postgresql://highway_cafe_user:secure_password_here@localhost:5432/highway_cafe

# Build application
npm run build

# Initialize database schema
npm run db:push

# Start application
npm start
```

### Windows 11 Native Setup

**Step 1: Install Prerequisites**
```powershell
# Install Node.js 20
# Download from: https://nodejs.org/dist/v20.latest/node-v20.x.x-x64.msi

# Install PostgreSQL 15
# Download from: https://www.postgresql.org/download/windows/

# Install Git
# Download from: https://git-scm.com/download/win

# Verify installations
node --version
npm --version
psql --version
git --version
```

**Step 2: Configure Database**
```powershell
# Open psql command prompt (from Start menu: SQL Shell)
# Enter connection details when prompted

# In psql, create database
CREATE DATABASE highway_cafe;
CREATE USER highway_cafe_user WITH PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE highway_cafe TO highway_cafe_user;
\q
```

**Step 3: Deploy Application**
```powershell
# Clone repository
git clone <repository-url> highway-cafe-pos
cd highway-cafe-pos

# Install dependencies
npm ci --production

# Set environment variables
$env:NODE_ENV="production"
$env:DATABASE_URL="postgresql://highway_cafe_user:secure_password_here@localhost:5432/highway_cafe"
$env:SESSION_SECRET="ultra-secure-session-secret-change-this"
$env:PORT="5000"

# Build application
npm run build

# Initialize database
npm run db:push

# Start application
npm start
```

## 📱 Multi-Device Configuration

### Android Tablet Setup

**Hardware Requirements:**
- Android 8.0+ (API level 26+)
- 8-12 inch screen (1024x768 minimum resolution)
- 2GB+ RAM
- WiFi connectivity

**Configuration Steps:**
```
1. Connect to Cafe WiFi Network
   - Settings → WiFi → Connect to cafe network
   - Note: Must be same network as server

2. Install/Update Chrome Browser
   - Google Play Store → Chrome → Update
   - Ensure version 90+ for best compatibility

3. Configure Browser Settings
   - Chrome → Settings → Site Settings → Cookies → Allow all
   - Chrome → Settings → Notifications → Allow for this site
   - Chrome → Settings → Desktop site → Enable

4. Access Application
   - Open Chrome
   - Navigate to: http://[SERVER-IP]:5000
   - Login with assigned role credentials
   - Chrome menu → "Add to Home screen"
   - Name: "Highway Cafe POS"

5. Optimize for Kiosk Use
   - Settings → Display → Screen timeout → 30 minutes
   - Settings → Display → Auto-brightness → OFF
   - Settings → Display → Brightness → 80%
   - Developer Options → Stay awake → ON (while charging)
```

### Windows 11 Tablet/Desktop Setup

**Configuration Steps:**
```
1. Network Connection
   - Connect to cafe WiFi network
   - Configure static IP if needed
   - Test connectivity: ping [SERVER-IP]

2. Browser Configuration
   - Install/update Edge or Chrome to latest version
   - Navigate to: http://[SERVER-IP]:5000
   - Pin tab or add to favorites
   - Enable full-screen mode (F11) for kiosk experience

3. Kiosk Mode Setup (Optional)
   - Create desktop shortcut
   - Modify target: "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk "http://[SERVER-IP]:5000"
   - Set as startup program

4. Touch Optimization
   - Settings → System → Tablet → When I sign in → Use tablet mode
   - Settings → Ease of Access → Touch → Make touch easier to use
```

### Ubuntu Desktop Setup

**Configuration Steps:**
```bash
# Install modern browser
sudo apt update
sudo apt install firefox chromium-browser

# Configure desktop environment
gsettings set org.gnome.desktop.session idle-delay 0
gsettings set org.gnome.desktop.screensaver lock-enabled false

# Create desktop shortcut
cat > ~/Desktop/highway-cafe-pos.desktop << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Highway Cafe POS
Comment=Point of Sale System
Exec=firefox --kiosk http://[SERVER-IP]:5000
Icon=applications-internet
Terminal=false
Categories=Office;
EOF

chmod +x ~/Desktop/highway-cafe-pos.desktop
```

## 🔧 System Administration

### Environment Configuration

**Production Environment Variables:**
```bash
# Required variables
NODE_ENV=production
DATABASE_URL=postgresql://username:password@host:5432/highway_cafe
SESSION_SECRET=ultra-secure-64-character-random-string-here
PORT=5000

# Optional variables
ENABLE_LOGGING=true
DATABASE_TYPE=postgres
TIMEZONE=America/New_York
MAX_CONNECTIONS=20
SESSION_TIMEOUT=86400
```

**Docker Environment Setup:**
```bash
# Create .env file for Docker
cat > .env << EOF
POSTGRES_PASSWORD=ultra-secure-database-password-here
SESSION_SECRET=ultra-secure-session-secret-here
NODE_ENV=production
EOF
```

### Database Management

**Manual Database Setup:**
```sql
-- Connect to PostgreSQL
\c highway_cafe

-- Verify tables exist
\dt

-- Check user permissions
\du

-- Create initial admin user (if needed)
INSERT INTO users (id, username, password, role, firstName, lastName, email, isActive)
VALUES (
  gen_random_uuid(),
  'admin',
  'admin123',
  'admin',
  'System',
  'Administrator',
  'admin@highway-cafe.com',
  true
);
```

**Database Backup Script:**
```bash
#!/bin/bash
# Save as: /usr/local/bin/backup-highway-cafe

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/highway-cafe"
mkdir -p $BACKUP_DIR

# Database backup
if command -v docker &> /dev/null; then
    # Docker deployment
    docker compose exec postgres pg_dump -U postgres highway_cafe > $BACKUP_DIR/db_$DATE.sql
else
    # Native deployment
    sudo -u postgres pg_dump highway_cafe > $BACKUP_DIR/db_$DATE.sql
fi

# Application backup
tar -czf $BACKUP_DIR/app_$DATE.tar.gz --exclude=node_modules --exclude=.git .

# Cleanup old backups (keep 7 days)
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

### Monitoring and Maintenance

**Health Check Script:**
```bash
#!/bin/bash
# Save as: /usr/local/bin/check-highway-cafe

# Check if application is responding
if curl -s http://localhost:5000/health > /dev/null; then
    echo "✅ Application is healthy"
else
    echo "❌ Application not responding"
    exit 1
fi

# Check database connectivity
if command -v docker &> /dev/null; then
    if docker compose exec postgres pg_isready -U postgres > /dev/null; then
        echo "✅ Database is healthy"
    else
        echo "❌ Database not responding"
        exit 1
    fi
fi

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "⚠️  Warning: Disk usage at ${DISK_USAGE}%"
fi

# Check memory usage
MEM_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ $MEM_USAGE -gt 80 ]; then
    echo "⚠️  Warning: Memory usage at ${MEM_USAGE}%"
fi

echo "System check completed"
```

**Log Rotation Configuration:**
```bash
# Create logrotate config
sudo tee /etc/logrotate.d/highway-cafe << EOF
/var/log/highway-cafe/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    copytruncate
}
EOF
```

## 🔒 Security Hardening

### Initial Security Setup

**Change Default Passwords:**
```bash
# Access application as admin
# Navigate to: User Management
# Change passwords for all default accounts:
# - admin/admin123 → secure-admin-password
# - manager/manager123 → secure-manager-password
# - cashier/cashier123 → secure-cashier-password
# - barista/barista123 → secure-barista-password
# - courier/courier123 → secure-courier-password
```

**System Security:**
```bash
# Ubuntu security updates
sudo apt update && sudo apt upgrade -y
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# Firewall configuration
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 5000
sudo ufw enable

# Fail2ban for login protection
sudo apt install fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

**SSL Certificate Setup (Optional):**
```bash
# Install certbot
sudo apt install certbot

# Generate certificate (if using domain name)
sudo certbot certonly --standalone -d your-domain.com

# Configure nginx as reverse proxy with SSL
sudo apt install nginx
```

### Network Security

**Router Configuration:**
```
1. Change default admin password
2. Enable WPA3 or WPA2 security
3. Create separate network for POS devices
4. Disable WPS
5. Enable MAC address filtering
6. Set up guest network for customers
7. Configure firewall rules
8. Enable automatic security updates
```

**Network Isolation:**
```bash
# Create separate VLAN for POS devices (if supported)
# Configure router to isolate POS network from internet
# Set up port forwarding only for necessary services
# Monitor network traffic for anomalies
```

## 🆘 Troubleshooting

### Common Issues and Solutions

**Issue: Docker build fails with "no space left on device"**
```bash
# Check disk space
df -h

# Clean Docker cache
docker system prune -a

# Remove unused volumes
docker volume prune

# If needed, extend disk space
sudo lvextend -L +10G /dev/ubuntu-vg/ubuntu-lv
sudo resize2fs /dev/ubuntu-vg/ubuntu-lv
```

**Issue: Application won't start - port 5000 in use**
```bash
# Find process using port 5000
sudo lsof -i :5000

# Kill the process
sudo kill -9 [PID]

# Or change application port
echo "PORT=3000" >> .env
```

**Issue: Database connection failed**
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Start PostgreSQL if stopped
sudo systemctl start postgresql

# Check database exists
sudo -u postgres psql -l | grep highway_cafe

# Test connection
sudo -u postgres psql -d highway_cafe -c "SELECT 1;"
```

**Issue: Permission denied errors**
```bash
# Fix file permissions
sudo chown -R $USER:$USER .
chmod -R 755 .

# Fix Docker permissions
sudo usermod -aG docker $USER
# Log out and back in
```

**Issue: Slow performance**
```bash
# Check system resources
top
free -h
df -h

# Check database performance
sudo -u postgres psql -d highway_cafe -c "SELECT * FROM pg_stat_activity;"

# Restart services
docker compose restart
# or
sudo systemctl restart highway-cafe
```

### Emergency Recovery

**Complete System Recovery:**
```bash
# Stop all services
docker compose down

# Remove all data (CAUTION: This deletes everything!)
docker volume rm highway-cafe-pos_postgres_data

# Restore from backup
docker compose up -d postgres
sleep 10
docker compose exec postgres psql -U postgres highway_cafe < /backup/highway-cafe/db_latest.sql

# Start application
docker compose up -d app
```

**Partial Recovery (Application Only):**
```bash
# Rebuild application only
docker compose build app
docker compose up -d app

# Check logs
docker compose logs app
```

## 📞 Support and Maintenance

### Regular Maintenance Schedule

**Daily:**
- [ ] Check application health endpoint
- [ ] Review error logs
- [ ] Verify backup completion

**Weekly:**
- [ ] Update system packages
- [ ] Review disk space usage
- [ ] Test backup restoration
- [ ] Check user activity logs

**Monthly:**
- [ ] Update application dependencies
- [ ] Review security logs
- [ ] Performance optimization
- [ ] User access audit

**Quarterly:**
- [ ] Full security audit
- [ ] Hardware health check
- [ ] Disaster recovery test
- [ ] Documentation updates

### Contact Information

**Technical Support:**
- System logs: `/var/log/` or `docker compose logs`
- Health endpoint: `http://localhost:5000/health`
- Database status: `docker compose exec postgres pg_isready`

**Emergency Contacts:**
- System Administrator: [Your contact info]
- Network Administrator: [Your contact info]
- Backup Administrator: [Your contact info]

---

**This setup guide ensures comprehensive deployment of the Highway Cafe POS system with all prerequisites, security measures, and maintenance procedures covered.**