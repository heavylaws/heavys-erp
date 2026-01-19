# Highway Cafe POS - Quick Start Guide

**Get the system running in under 10 minutes!**

## 🚀 Option 1: One-Command Deployment (Recommended)

### Linux/macOS
```bash
git clone <repository-url> highway-cafe-pos
cd highway-cafe-pos
./deploy-production.sh
```

### Windows 11
```powershell
git clone <repository-url> highway-cafe-pos
cd highway-cafe-pos
.\deploy-production.ps1
```

**That's it!** Access at: `http://localhost:5000`

## 🔧 Option 2: Manual Setup

### Step 1: Install Docker
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in

# Windows: Download Docker Desktop
# macOS: Download Docker Desktop
```

### Step 2: Deploy
```bash
docker compose -f docker-compose.production.yml up -d
```

### Step 3: Access
- **Local:** http://localhost:5000
- **Network:** http://[YOUR-IP]:5000

## 🔑 Default Logins

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123 |
| Cashier | cashier | cashier123 |
| Courier | courier | courier123 |

⚠️ **Change passwords immediately!**

## 📱 Connect Devices

### Android Tablets
1. Connect to same WiFi as server
2. Open Chrome → http://[SERVER-IP]:5000
3. Add to Home screen
4. Enable desktop mode

### Windows/Linux Computers
1. Open browser → http://[SERVER-IP]:5000
2. Bookmark or pin tab
3. Use F11 for full-screen

## 🆘 Troubleshooting

**Port 5000 in use?**
```bash
sudo lsof -ti:5000 | xargs kill -9
```

**Docker permission denied?**
```bash
sudo usermod -aG docker $USER
# Log out and back in
```

**Build fails?**
```bash
docker system prune -a
./deploy-production.sh
```

**Health check fails?**
```bash
docker compose logs app
curl http://localhost:5000/health
```

## 🔧 Management Commands

```bash
# View logs
docker compose -f docker-compose.production.yml logs -f

# Stop system
docker compose -f docker-compose.production.yml down

# Restart system
./deploy-production.sh

# Check status
docker compose -f docker-compose.production.yml ps
curl http://localhost:5000/health
```

## 📖 Next Steps

1. **Change default passwords** (Admin → User Management)
2. **Set currency rates** (Admin → Currency)
3. **Add products** (Manager → Products)
4. **Configure users** (Admin → Users)
5. **Test ordering** (Cashier interface)

## 📚 Documentation

- **Complete Setup:** [SETUP-GUIDE.md](SETUP-GUIDE.md)
- **Deployment Details:** [DEPLOYMENT.md](DEPLOYMENT.md)
- **API Reference:** [README.md#api-documentation](README.md#api-documentation)

---

**Need help?** Check logs first, then review the troubleshooting section above.