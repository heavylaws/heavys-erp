# Highway Cafe POS - Linux Mint Production Deployment Guide

## System Overview
**Stack**: Node.js 20 + Express + PostgreSQL + React/Vite + WebSocket  
**Service**: highway-cafe-pos  
**Domain**: Local network deployment (192.168.x.x:5000)  
**SSL**: Self-signed certificate for HTTPS  
**Database**: PostgreSQL with real-time inventory tracking  

## Repository Layout
```
highway-cafe-pos/
├── client/src/          # React frontend (TypeScript)
├── server/              # Express backend (TypeScript)
├── shared/schema.ts     # Drizzle ORM schemas
├── package.json         # Dependencies & scripts
├── init-db.sql         # Database initialization
├── .env.example        # Environment variables template
└── dist/               # Production build output
```

## Runtime Requirements
- **Node.js**: 20.x LTS
- **Database**: PostgreSQL 14+
- **Ports**: 5000 (HTTP), 5432 (PostgreSQL)
- **Environment Variables**: DATABASE_URL, NODE_ENV=production
- **Background Workers**: WebSocket server for real-time updates
- **Static Assets**: Frontend served from dist/public/

---

## 🔍 Ship-Readiness Checklist

### Dependencies Check
- [ ] Node.js 20.x installed
- [ ] PostgreSQL 14+ running
- [ ] Git repository accessible
- [ ] Port 5000 available
- [ ] Minimum 2GB RAM available
- [ ] 10GB disk space free

### Configuration Check
- [ ] .env file created with DATABASE_URL
- [ ] PostgreSQL user created with permissions
- [ ] Database schema matches Drizzle ORM
- [ ] SSL certificates generated (self-signed)
- [ ] Firewall rules configured

### Build & Migration Check
- [ ] npm install successful
- [ ] Frontend build completes (vite build)
- [ ] Backend build completes (esbuild)
- [ ] Database migrations applied
- [ ] Demo data seeded successfully

### Service Check
- [ ] systemd service starts correctly
- [ ] Nginx reverse proxy configured
- [ ] WebSocket connections working
- [ ] Application responds on port 5000
- [ ] Health check endpoint returns 200

---

## 🐧 Linux Mint Setup Commands

### 1. System Preparation
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git nginx postgresql postgresql-contrib ufw

# Install Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installations
node --version    # Should show v20.x.x
npm --version     # Should show 10.x.x
psql --version    # Should show 14.x or higher
```

### 2. User & Directory Setup
```bash
# Create application user
sudo useradd -r -m -s /bin/bash highway-cafe
sudo usermod -a -G sudo highway-cafe

# Create application directory
sudo mkdir -p /opt/highway-cafe-pos
sudo chown highway-cafe:highway-cafe /opt/highway-cafe-pos

# Create log directory
sudo mkdir -p /var/log/highway-cafe
sudo chown highway-cafe:highway-cafe /var/log/highway-cafe
```

### 3. PostgreSQL Database Setup
```bash
# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << 'EOF'
CREATE USER highway_cafe WITH PASSWORD 'secure_password_here';
CREATE DATABASE highway_cafe_pos OWNER highway_cafe;
GRANT ALL PRIVILEGES ON DATABASE highway_cafe_pos TO highway_cafe;
ALTER USER highway_cafe CREATEDB;
\q
EOF

# Test database connection
sudo -u highway-cafe psql -h localhost -U highway_cafe -d highway_cafe_pos -c "SELECT version();"
```

### 4. Firewall Configuration
```bash
# Enable UFW firewall
sudo ufw enable

# Allow SSH (if using remote access)
sudo ufw allow 22

# Allow HTTP and HTTPS
sudo ufw allow 80
sudo ufw allow 443

# Allow application port (for direct access)
sudo ufw allow 5000

# Allow PostgreSQL (localhost only)
sudo ufw allow from 127.0.0.1 to any port 5432

# Check firewall status
sudo ufw status verbose
```

### 5. SSL Certificate Generation (Self-Signed)
```bash
# Create SSL directory
sudo mkdir -p /etc/ssl/highway-cafe
sudo chown highway-cafe:highway-cafe /etc/ssl/highway-cafe

# Generate self-signed certificate
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/highway-cafe/private.key \
  -out /etc/ssl/highway-cafe/certificate.crt \
  -subj "/C=US/ST=State/L=City/O=Highway Cafe/CN=highway-cafe.local"

# Set proper permissions
sudo chmod 600 /etc/ssl/highway-cafe/private.key
sudo chmod 644 /etc/ssl/highway-cafe/certificate.crt
```

---

## ⚙️ systemd Service Configuration

### Create Service File
```bash
sudo tee /etc/systemd/system/highway-cafe-pos.service << 'EOF'
[Unit]
Description=Highway Cafe POS System
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=highway-cafe
Group=highway-cafe
WorkingDirectory=/opt/highway-cafe-pos
ExecStart=/usr/bin/node dist/index.cjs
ExecReload=/bin/kill -HUP $MAINPID
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=highway-cafe-pos

# Environment variables
Environment=NODE_ENV=production
Environment=PORT=5000
EnvironmentFile=-/opt/highway-cafe-pos/.env

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/opt/highway-cafe-pos /var/log/highway-cafe

[Install]
WantedBy=multi-user.target
EOF
```

### Enable and Start Service
```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable highway-cafe-pos

# Service will be started after deployment
```

---

## 🌐 Nginx Reverse Proxy Configuration

### Main Configuration
```bash
sudo tee /etc/nginx/sites-available/highway-cafe-pos << 'EOF'
# HTTP redirect to HTTPS
server {
    listen 80;
    server_name highway-cafe.local _;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name highway-cafe.local _;

    # SSL configuration
    ssl_certificate /etc/ssl/highway-cafe/certificate.crt;
    ssl_certificate_key /etc/ssl/highway-cafe/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Logging
    access_log /var/log/nginx/highway-cafe-access.log;
    error_log /var/log/nginx/highway-cafe-error.log;

    # Main application
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }

    # WebSocket support
    location /ws {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://127.0.0.1:5000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:5000/health;
        access_log off;
    }
}
EOF
```

### Enable Nginx Configuration
```bash
# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Enable highway-cafe site
sudo ln -s /etc/nginx/sites-available/highway-cafe-pos /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

---

## 🚀 First Deployment

### 1. Clone and Build Application
```bash
# Switch to application user
sudo -u highway-cafe -i

# Clone repository
cd /opt/highway-cafe-pos
git clone https://github.com/your-repo/highway-cafe-pos.git .

# Create environment file
cat > .env << 'EOF'
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://highway_cafe:secure_password_here@localhost:5432/highway_cafe_pos
EOF

# Install dependencies
npm ci --only=production

# Build application
npm run build

# Initialize database
psql $DATABASE_URL < init-db.sql

# Apply database migrations
npm run db:push

# Exit back to root
exit
```

### 2. Start Services
```bash
# Start the application service
sudo systemctl start highway-cafe-pos

# Check service status
sudo systemctl status highway-cafe-pos

# Restart Nginx to ensure everything is connected
sudo systemctl restart nginx
```

### 3. Smoke Tests
```bash
# Test application health
curl -k https://localhost/health
# Expected: {"status":"ok","timestamp":"..."}

# Test main page
curl -k https://localhost/
# Expected: HTML content with "Highway Cafe"

# Test API endpoint
curl -k https://localhost/api/products
# Expected: JSON array of products

# Test WebSocket (if wscat is available)
npm install -g wscat
wscat -c wss://localhost/ws
# Expected: WebSocket connection established

# Check application logs
sudo journalctl -u highway-cafe-pos -f --lines=50
```

### 4. Network Access Test
```bash
# Get local IP address
ip route get 1.1.1.1 | grep -oP 'src \K\S+'

# Test from another device on the network
# Replace 192.168.1.100 with your actual IP
curl -k https://192.168.1.100/health
```

---

## 🔄 Rollback Plan

### 1. Quick Rollback Script
```bash
sudo tee /opt/highway-cafe-pos/rollback.sh << 'EOF'
#!/bin/bash
set -e

echo "Starting rollback procedure..."

# Stop application
sudo systemctl stop highway-cafe-pos

# Restore previous version (if available)
if [ -d "/opt/highway-cafe-pos/backup" ]; then
    echo "Restoring previous version..."
    cp -r /opt/highway-cafe-pos/backup/* /opt/highway-cafe-pos/
    
    # Restore database backup (if available)
    if [ -f "/opt/highway-cafe-pos/backup.sql" ]; then
        echo "Restoring database..."
        psql $DATABASE_URL < /opt/highway-cafe-pos/backup.sql
    fi
    
    # Start application
    sudo systemctl start highway-cafe-pos
    echo "Rollback completed successfully"
else
    echo "No backup found. Manual intervention required."
    exit 1
fi
EOF

sudo chmod +x /opt/highway-cafe-pos/rollback.sh
```

### 2. Database Backup Before Deployment
```bash
# Create database backup before each deployment
pg_dump $DATABASE_URL > /opt/highway-cafe-pos/backup_$(date +%Y%m%d_%H%M%S).sql
```

---

## 📊 Ongoing Operations

### 1. Log Management
```bash
# View application logs
sudo journalctl -u highway-cafe-pos -f

# View Nginx logs
sudo tail -f /var/log/nginx/highway-cafe-access.log
sudo tail -f /var/log/nginx/highway-cafe-error.log

# Rotate logs (add to crontab)
sudo crontab -e
# Add: 0 0 * * 0 /usr/sbin/logrotate /etc/logrotate.conf
```

### 2. Backup Strategy
```bash
# Daily database backup script
sudo tee /opt/highway-cafe-pos/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/highway-cafe-pos/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Database backup
pg_dump $DATABASE_URL | gzip > $BACKUP_DIR/db_backup_$DATE.sql.gz

# Application backup
tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz -C /opt/highway-cafe-pos \
  --exclude=backups --exclude=node_modules --exclude=.git .

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
EOF

sudo chmod +x /opt/highway-cafe-pos/backup.sh

# Add to crontab for daily execution
sudo -u highway-cafe crontab -e
# Add: 0 2 * * * /opt/highway-cafe-pos/backup.sh >> /var/log/highway-cafe/backup.log 2>&1
```

### 3. Update Procedure
```bash
# Create update script
sudo tee /opt/highway-cafe-pos/update.sh << 'EOF'
#!/bin/bash
set -e

echo "Starting update procedure..."

# Create backup before update
./backup.sh

# Stop service
sudo systemctl stop highway-cafe-pos

# Pull latest changes
git pull origin main

# Install dependencies
npm ci --only=production

# Build application
npm run build

# Apply database migrations
npm run db:push

# Start service
sudo systemctl start highway-cafe-pos

# Wait for service to be ready
sleep 10

# Health check
if curl -k -f https://localhost/health > /dev/null 2>&1; then
    echo "Update completed successfully"
    sudo systemctl status highway-cafe-pos
else
    echo "Health check failed, initiating rollback..."
    ./rollback.sh
    exit 1
fi
EOF

sudo chmod +x /opt/highway-cafe-pos/update.sh
```

### 4. Monitoring Setup
```bash
# Simple monitoring script
sudo tee /opt/highway-cafe-pos/monitor.sh << 'EOF'
#!/bin/bash

# Check if service is running
if ! systemctl is-active --quiet highway-cafe-pos; then
    echo "$(date): Service is down, attempting restart" >> /var/log/highway-cafe/monitor.log
    sudo systemctl restart highway-cafe-pos
fi

# Check application health
if ! curl -k -f https://localhost/health > /dev/null 2>&1; then
    echo "$(date): Health check failed" >> /var/log/highway-cafe/monitor.log
    sudo systemctl restart highway-cafe-pos
fi

# Check disk space
DISK_USAGE=$(df /opt/highway-cafe-pos | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "$(date): Disk usage high: $DISK_USAGE%" >> /var/log/highway-cafe/monitor.log
fi
EOF

sudo chmod +x /opt/highway-cafe-pos/monitor.sh

# Add to crontab for monitoring every 5 minutes
sudo -u highway-cafe crontab -e
# Add: */5 * * * * /opt/highway-cafe-pos/monitor.sh
```

---

## 🔧 Troubleshooting Commands

### Service Issues
```bash
# Check service status
sudo systemctl status highway-cafe-pos

# View detailed logs
sudo journalctl -u highway-cafe-pos --since "1 hour ago"

# Restart service
sudo systemctl restart highway-cafe-pos

# Check port usage
sudo netstat -tlnp | grep :5000
```

### Database Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Connect to database
sudo -u highway-cafe psql -d highway_cafe_pos

# Check database connections
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"
```

### Network Issues
```bash
# Check Nginx status
sudo systemctl status nginx

# Test Nginx configuration
sudo nginx -t

# Check local connectivity
curl -k https://localhost/health

# Check firewall
sudo ufw status verbose
```

### Performance Monitoring
```bash
# Check system resources
htop
df -h
free -m

# Check application processes
ps aux | grep node

# Monitor network connections
sudo ss -tulpn | grep :5000
```

---

## 📋 Quick Reference

### Essential Commands
```bash
# Service management
sudo systemctl {start|stop|restart|status} highway-cafe-pos

# View logs
sudo journalctl -u highway-cafe-pos -f

# Update application
cd /opt/highway-cafe-pos && sudo -u highway-cafe ./update.sh

# Manual backup
cd /opt/highway-cafe-pos && sudo -u highway-cafe ./backup.sh

# Rollback
cd /opt/highway-cafe-pos && sudo -u highway-cafe ./rollback.sh
```

### Important Paths
- **Application**: `/opt/highway-cafe-pos/`
- **Logs**: `/var/log/highway-cafe/`
- **Config**: `/etc/systemd/system/highway-cafe-pos.service`
- **Nginx**: `/etc/nginx/sites-available/highway-cafe-pos`
- **SSL**: `/etc/ssl/highway-cafe/`
- **Database**: `postgresql://highway_cafe:password@localhost:5432/highway_cafe_pos`

### Default Access
- **HTTPS**: `https://[LOCAL-IP]/` (Primary)
- **HTTP**: `http://[LOCAL-IP]/` (Redirects to HTTPS)
- **Health Check**: `https://[LOCAL-IP]/health`
- **Admin Login**: `admin` / `admin123`
- **Manager Login**: `manager` / `manager123`

---

**Deployment Complete**: Your Highway Cafe POS system is now production-ready on Linux Mint with full monitoring, backup, and rollback capabilities.