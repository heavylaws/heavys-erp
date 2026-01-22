# Heavys ERP - Lubuntu/Ubuntu Server Setup Guide

## Quick Start (One-Liner Installation)

Run this command on your Lubuntu/Ubuntu server:

```bash
curl -fsSL https://raw.githubusercontent.com/heavylaws/heavys-erp/main/download-and-install.sh | sudo bash
```

Or if you prefer wget:

```bash
wget -qO- https://raw.githubusercontent.com/heavylaws/heavys-erp/main/download-and-install.sh | sudo bash
```

---

## What the Installer Does

1. ✅ Installs Node.js 20, PostgreSQL, and required dependencies
2. ✅ Creates a dedicated `heavys` user and directories
3. ✅ Sets up the PostgreSQL database
4. ✅ Downloads and builds the application
5. ✅ Configures environment variables
6. ✅ Sets up systemd service for **auto-startup on boot**
7. ✅ Starts the service and configures firewall

---

## Manual Installation

If you prefer to install manually, follow these steps:

### Step 1: Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git build-essential postgresql postgresql-contrib

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v  # Should show v20.x.x
npm -v   # Should show 10.x.x
```

### Step 2: Create User and Directories

```bash
# Create application user
sudo useradd -r -m -s /bin/bash heavys

# Create directories
sudo mkdir -p /opt/heavys-erp
sudo mkdir -p /var/log/heavys-erp
sudo chown -R heavys:heavys /opt/heavys-erp /var/log/heavys-erp
```

### Step 3: Setup Database

```bash
# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql << 'EOF'
CREATE USER heavys WITH PASSWORD 'heavys123';
CREATE DATABASE heavys_erp OWNER heavys;
GRANT ALL PRIVILEGES ON DATABASE heavys_erp TO heavys;
EOF
```

### Step 4: Clone and Build Application

```bash
# Switch to app user
sudo -u heavys -i

# Clone repository
cd /opt/heavys-erp
git clone https://github.com/heavylaws/heavys-erp.git .

# Install dependencies
npm install

# Build
npm run build

# Exit back to your user
exit
```

### Step 5: Configure Environment

```bash
sudo -u heavys bash -c 'cat > /opt/heavys-erp/.env << EOF
PORT=5000
HOST=0.0.0.0
NODE_ENV=production
DATABASE_URL=postgresql://heavys:heavys123@localhost:5432/heavys_erp
SESSION_SECRET=$(openssl rand -hex 32)
DEFAULT_ADMIN_USERNAME=admin
DEFAULT_ADMIN_PASSWORD=admin123
SESSION_MAX_AGE=86400000
SESSION_ROLLING=true
EOF'

sudo chmod 600 /opt/heavys-erp/.env
```

### Step 6: Setup Systemd Service (Auto-Startup)

```bash
# Copy the service file
sudo cp /opt/heavys-erp/heavys-erp.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable auto-start on boot
sudo systemctl enable heavys-erp

# Start the service now
sudo systemctl start heavys-erp

# Check status
sudo systemctl status heavys-erp
```

---

## Service Management Commands

```bash
# Check service status
sudo systemctl status heavys-erp

# Start service
sudo systemctl start heavys-erp

# Stop service
sudo systemctl stop heavys-erp

# Restart service
sudo systemctl restart heavys-erp

# View live logs
sudo journalctl -u heavys-erp -f

# View recent logs
sudo journalctl -u heavys-erp --since "1 hour ago"

# Disable auto-start
sudo systemctl disable heavys-erp

# Re-enable auto-start
sudo systemctl enable heavys-erp
```

---

## Access the Application

After installation, access the application at:

```
http://YOUR_SERVER_IP:5000
```

**Default Login:**
- Username: `admin`
- Password: `admin123`

> ⚠️ **IMPORTANT:** Change the default password immediately after first login!

---

## Updating the Application

```bash
# Stop the service
sudo systemctl stop heavys-erp

# Update code
cd /opt/heavys-erp
sudo -u heavys git pull origin main

# Reinstall dependencies and rebuild
sudo -u heavys npm install
sudo -u heavys npm run build

# Apply database migrations
sudo -u heavys npm run db:push

# Start the service
sudo systemctl start heavys-erp
```

---

## Troubleshooting

### Service won't start

```bash
# Check detailed logs
sudo journalctl -u heavys-erp -n 100 --no-pager

# Check if port is in use
sudo lsof -i :5000

# Try running manually
cd /opt/heavys-erp
sudo -u heavys node dist/index.cjs
```

### Database connection issues

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test database connection
sudo -u heavys psql -h localhost -U heavys -d heavys_erp -c "SELECT 1;"
```

### Permission issues

```bash
# Fix ownership
sudo chown -R heavys:heavys /opt/heavys-erp
sudo chown -R heavys:heavys /var/log/heavys-erp

# Fix permissions
sudo chmod 600 /opt/heavys-erp/.env
```

---

## File Locations

| Item | Path |
|------|------|
| Application | `/opt/heavys-erp/` |
| Environment Config | `/opt/heavys-erp/.env` |
| Systemd Service | `/etc/systemd/system/heavys-erp.service` |
| Logs | `journalctl -u heavys-erp` |
| Database | `heavys_erp` on PostgreSQL |

---

## Security Recommendations

1. **Change default passwords** in `.env` and web interface
2. **Configure firewall** to only allow necessary ports
3. **Use HTTPS** with a reverse proxy (nginx) for production
4. **Regular backups** of the database
5. **Keep system updated** with security patches
