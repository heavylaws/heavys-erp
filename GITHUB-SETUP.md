# GitHub Repository Setup Guide

This guide walks you through setting up your Highway Cafe POS project on GitHub.

## 📋 Pre-Setup Checklist

Before creating the GitHub repository, ensure you have:
- [ ] GitHub account created
- [ ] Git installed locally
- [ ] SSH key or personal access token configured
- [ ] All sensitive data removed from the project

## 🚀 Step 1: Create GitHub Repository

### Option A: Using GitHub Web Interface
1. Go to [GitHub.com](https://github.com) and sign in
2. Click the "+" icon → "New repository"
3. Repository settings:
   - **Name**: `highway-cafe-pos`
   - **Description**: `Professional Point of Sale system for highway cafes with advanced inventory management and real-time analytics`
   - **Visibility**: Choose Public or Private
   - **Initialize**: ❌ Don't initialize (we have existing code)
4. Click "Create repository"

### Option B: Using GitHub CLI
```bash
gh repo create highway-cafe-pos --description "Professional Point of Sale system for highway cafes" --public
```

## 🔧 Step 2: Initialize Local Git Repository

```bash
# Initialize git repository (if not already done)
git init

# Add all files to staging
git add .

# Create initial commit
git commit -m "feat: initial commit - Highway Cafe POS system

- Complete POS system with role-based authentication
- Advanced inventory management with low stock alerts
- Enhanced order management with search and filtering
- Cost management system with profit analysis
- Real-time WebSocket updates across devices
- Dual currency support (USD/LBP)
- Comprehensive deployment guides for multiple platforms
- Docker containerization for production deployment"

# Update GitHub repository remote origin
git remote set-url origin https://github.com/heavylaws/Cafe24Pos.git

# Push to GitHub
git push -u origin main
```

## 🔒 Step 3: Secure Repository Setup

### Remove Sensitive Files
Ensure these files are in `.gitignore` and not tracked:
```bash
# Check if sensitive files are tracked
git ls-files | grep -E "\.(env|key|pem|crt)$"

# If any sensitive files are found, remove them:
git rm --cached .env
git rm --cached *.key
git commit -m "security: remove sensitive files from tracking"
```

### Verify .gitignore Coverage
```bash
# Test .gitignore is working
echo "test-secret=123" > .env.test
git status  # Should not show .env.test

# Clean up test file
rm .env.test
```

## 📚 Step 4: Repository Configuration

### Enable Branch Protection
In GitHub web interface:
1. Go to **Settings** → **Branches**
2. Click **Add rule** for `main` branch
3. Enable:
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - ✅ Include administrators

### Set up Repository Secrets
For deployment automation:
1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Add repository secrets:
   - `DATABASE_URL`: Production database connection string
   - `SESSION_SECRET`: Secure session secret
   - `DOCKER_REGISTRY_TOKEN`: If using private registry

### Configure Issues Templates
```bash
# Create issue templates directory
mkdir -p .github/ISSUE_TEMPLATE

# Bug report template
cat > .github/ISSUE_TEMPLATE/bug_report.md << 'EOF'
---
name: Bug report
about: Create a report to help us improve
title: '[BUG] '
labels: bug
assignees: ''
---

**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment:**
 - OS: [e.g. Ubuntu 20.04, Windows 11]
 - Browser: [e.g. Chrome 90, Firefox 88]
 - Device: [e.g. Desktop, Android Tablet]
 - Version: [e.g. v1.0.0]

**Additional context**
Add any other context about the problem here.
EOF

# Feature request template
cat > .github/ISSUE_TEMPLATE/feature_request.md << 'EOF'
---
name: Feature request
about: Suggest an idea for this project
title: '[FEATURE] '
labels: enhancement
assignees: ''
---

**Is your feature request related to a problem? Please describe.**
A clear and concise description of what the problem is.

**Describe the solution you'd like**
A clear and concise description of what you want to happen.

**Describe alternatives you've considered**
A clear and concise description of any alternative solutions you've considered.

**Additional context**
Add any other context or screenshots about the feature request here.
EOF
```

## 🔄 Step 5: Set up Development Workflow

### Create Pull Request Template
```bash
mkdir -p .github
cat > .github/pull_request_template.md << 'EOF'
## Description
Brief description of changes made.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] I have performed a self-review of my code
- [ ] I have tested the changes locally
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works

## Screenshots (if applicable)
Add screenshots to help explain your changes.

## Checklist
- [ ] My code follows the style guidelines of this project
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes pass all existing tests
EOF
```

### Add GitHub Actions Workflow (Optional)
```bash
mkdir -p .github/workflows
cat > .github/workflows/ci.yml << 'EOF'
name: CI/CD Pipeline

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: highway_cafe_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Type checking
      run: npm run check
    
    - name: Build application
      run: npm run build
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/highway_cafe_test
    
    - name: Run tests (if available)
      run: npm test --if-present
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/highway_cafe_test

  build-docker:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Build Docker image
      run: docker build -t highway-cafe-pos:latest .
    
    - name: Test Docker image
      run: |
        docker run -d --name test-container highway-cafe-pos:latest
        sleep 10
        docker logs test-container
        docker stop test-container
        docker rm test-container
EOF
```

## 📝 Step 6: Commit Repository Configuration

```bash
# Add all new configuration files
git add .github/
git add GITHUB-SETUP.md
git add LICENSE
git add CONTRIBUTING.md

# Commit configuration
git commit -m "docs: add GitHub repository configuration

- Add issue and PR templates
- Add contributing guidelines
- Add MIT license
- Add CI/CD workflow for automated testing
- Add repository setup documentation"

# Push to GitHub
git push origin main
```

## 🏷️ Step 7: Create Initial Release

### Tag the Initial Version
```bash
# Create and push initial version tag
git tag -a v1.0.0 -m "v1.0.0: Initial stable release

Features:
- Complete POS system with role-based authentication
- Advanced inventory management with alerts
- Enhanced order management with filtering
- Cost management and profit analysis
- Real-time WebSocket updates
- Multi-platform deployment support
- Comprehensive documentation suite"

git push origin v1.0.0
```

### Create GitHub Release
1. Go to your repository on GitHub
2. Click **Releases** → **Create a new release**
3. Tag version: `v1.0.0`
4. Release title: `Highway Cafe POS v1.0.0 - Initial Stable Release`
5. Description:
```markdown
## 🎉 Initial Stable Release

Professional Point of Sale system for highway cafes with comprehensive management features.

### ✨ Key Features
- **Complete POS System**: Role-based authentication for 5 user types
- **Advanced Inventory**: Low stock alerts, recipe management, automatic deduction
- **Enhanced Order Management**: Search, filtering, editing with manager controls
- **Cost Management**: Profit analysis and inventory valuation
- **Real-time Updates**: WebSocket synchronization across all devices
- **Multi-platform Deployment**: Docker, Linux, Windows, Android tablet support

### 🚀 Quick Start
```bash
git clone https://github.com/YOUR_USERNAME/highway-cafe-pos.git
cd highway-cafe-pos
chmod +x deploy-production.sh
./deploy-production.sh
```

### 📱 Default Credentials
- Admin: `admin` / `admin123`
- Manager: `manager` / `manager123`
- Cashier: `cashier` / `cashier123`

### 📚 Documentation
- [Deployment Guide](DEPLOYMENT.md)
- [Linux Setup](LINUX-MINT-DEPLOYMENT.md)
- [Testing Guide](TESTING-GUIDE.md)
- [Setup Instructions](SETUP-GUIDE.md)

### 🛠️ Tech Stack
Node.js 20, React 18, TypeScript, PostgreSQL 15, Docker
```

6. Click **Publish release**

## 📊 Step 8: Repository Insights Setup

### Add Repository Topics
In GitHub repository settings:
- `pos-system`
- `restaurant-management`
- `inventory-management`
- `nodejs`
- `react`
- `typescript`
- `postgresql`
- `docker`
- `highway-cafe`
- `point-of-sale`

### Update Repository Description
Add this as the repository description:
```
Professional Point of Sale system for highway cafes with advanced inventory management, real-time order tracking, cost analysis, and multi-platform deployment support.
```

### Add Repository Website
Link to your documentation or demo site if available.

## 🔍 Step 9: Verify Repository Setup

### Final Checklist
- [ ] Repository created and configured
- [ ] All code pushed to `main` branch
- [ ] No sensitive data in repository
- [ ] README.md displays correctly
- [ ] License file present
- [ ] Contributing guidelines added
- [ ] Issue templates configured
- [ ] Pull request template added
- [ ] Branch protection enabled
- [ ] Repository topics added
- [ ] Initial release created
- [ ] CI/CD workflow configured (optional)

### Test Repository Access
```bash
# Clone repository fresh to test
cd /tmp
git clone https://github.com/YOUR_USERNAME/highway-cafe-pos.git test-repo
cd test-repo
ls -la  # Verify all files present
cat README.md | head -20  # Verify README displays correctly
```

## 🌐 Step 10: Share Your Repository

### Repository URL
```
https://github.com/YOUR_USERNAME/highway-cafe-pos
```

### Clone Command for Others
```bash
git clone https://github.com/YOUR_USERNAME/highway-cafe-pos.git
```

### README Badge (Optional)
Add to README.md:
```markdown
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/docker-ready-blue)](https://www.docker.com/)
```

---

🎉 **Your Highway Cafe POS repository is now live on GitHub!**

Next steps:
1. Share the repository URL with your team
2. Set up local development environments
3. Begin collaborative development
4. Deploy to production using the deployment guides