# Highway Cafe POS - Windows PowerShell Production Deployment Script
# Run as Administrator for best results

param(
    [string]$Action = "deploy",
    [switch]$SkipDocker = $false,
    [switch]$Clean = $false
)

# Enable strict error handling
$ErrorActionPreference = "Stop"

# Function to log with timestamp
function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $color = switch ($Level) {
        "ERROR" { "Red" }
        "WARNING" { "Yellow" }
        "SUCCESS" { "Green" }
        default { "White" }
    }
    Write-Host "[$timestamp] $Message" -ForegroundColor $color
}

# Check if running as Administrator
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Check prerequisites
function Test-Prerequisites {
    Write-Log "Checking system prerequisites..." "INFO"
    
    # Check if running as admin
    if (-not (Test-Administrator)) {
        Write-Log "Warning: Not running as Administrator. Some operations may fail." "WARNING"
    }
    
    # Check Docker
    if (-not $SkipDocker) {
        try {
            $dockerVersion = docker --version
            Write-Log "Docker found: $dockerVersion" "SUCCESS"
        }
        catch {
            Write-Log "Docker not found. Please install Docker Desktop for Windows." "ERROR"
            Write-Log "Download from: https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe" "INFO"
            exit 1
        }
        
        try {
            $composeVersion = docker compose version
            Write-Log "Docker Compose found: $composeVersion" "SUCCESS"
        }
        catch {
            Write-Log "Docker Compose not available. Please update Docker Desktop." "ERROR"
            exit 1
        }
    }
    
    # Check Git
    try {
        $gitVersion = git --version
        Write-Log "Git found: $gitVersion" "SUCCESS"
    }
    catch {
        Write-Log "Git not found. Please install Git for Windows." "WARNING"
    }
    
    # Check available disk space (minimum 10GB)
    $drive = Get-WmiObject -Class Win32_LogicalDisk -Filter "DeviceID='C:'"
    $freeSpaceGB = [math]::Round($drive.FreeSpace / 1GB, 2)
    if ($freeSpaceGB -lt 10) {
        Write-Log "Warning: Low disk space ($freeSpaceGB GB). Minimum 10GB recommended." "WARNING"
    } else {
        Write-Log "Disk space OK: $freeSpaceGB GB available" "SUCCESS"
    }
}

# Main deployment function
function Start-Deployment {
    Write-Log "🚀 Highway Cafe POS - Windows Production Deployment" "INFO"
    Write-Log "====================================================" "INFO"
    
    # Clean previous deployment if requested
    if ($Clean) {
        Write-Log "Cleaning previous deployment..." "INFO"
        try {
            docker compose -f docker-compose.production.yml down --remove-orphans --volumes 2>$null
            docker system prune -f 2>$null
            Write-Log "Cleanup completed" "SUCCESS"
        }
        catch {
            Write-Log "Cleanup completed with warnings" "WARNING"
        }
    }
    
    # Stop existing containers
    Write-Log "Stopping existing containers..." "INFO"
    try {
        docker compose -f docker-compose.production.yml down --remove-orphans 2>$null
    }
    catch {
        Write-Log "No existing containers to stop" "INFO"
    }
    
    # Build application
    Write-Log "Building Highway Cafe POS..." "INFO"
    try {
        docker compose -f docker-compose.production.yml build --no-cache
        Write-Log "Build completed successfully" "SUCCESS"
    }
    catch {
        Write-Log "Build failed. Check Docker logs for details." "ERROR"
        exit 1
    }
    
    # Start services
    Write-Log "Starting production services..." "INFO"
    try {
        docker compose -f docker-compose.production.yml up -d
        Write-Log "Services started successfully" "SUCCESS"
    }
    catch {
        Write-Log "Failed to start services. Check logs for details." "ERROR"
        exit 1
    }
    
    # Wait for services to be ready
    Write-Log "Waiting for services to initialize..." "INFO"
    Start-Sleep -Seconds 15
    
    # Check application health
    $maxRetries = 30
    $retryCount = 0
    $healthOK = $false
    
    while ($retryCount -lt $maxRetries -and -not $healthOK) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:5000/health" -TimeoutSec 5 -UseBasicParsing
            if ($response.StatusCode -eq 200) {
                $healthOK = $true
                Write-Log "✅ Highway Cafe POS is running successfully!" "SUCCESS"
                break
            }
        }
        catch {
            # Service not ready yet
        }
        
        $retryCount++
        if ($retryCount % 5 -eq 0) {
            Write-Log "Still waiting for application to start... ($retryCount/$maxRetries)" "INFO"
        }
        Start-Sleep -Seconds 2
    }
    
    if (-not $healthOK) {
        Write-Log "❌ Application failed to start within 60 seconds" "ERROR"
        Write-Log "Checking container logs..." "INFO"
        docker compose -f docker-compose.production.yml logs --tail=20
        exit 1
    }
    
    # Display access information
    Write-Log "🎯 Deployment successful! Access information:" "SUCCESS"
    Write-Log "📱 Local access: http://localhost:5000" "INFO"
    
    # Get network interfaces for remote access
    try {
        $networkAdapters = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.IPAddress -ne "169.254.*" }
        Write-Log "🌐 Network access from other devices:" "INFO"
        foreach ($adapter in $networkAdapters) {
            if ($adapter.IPAddress -match "^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[01])\.") {
                Write-Log "   http://$($adapter.IPAddress):5000" "INFO"
            }
        }
    }
    catch {
        Write-Log "   Check your IP address manually for network access" "INFO"
    }
    
    Write-Log ""
    Write-Log "🔑 Default Login Credentials:" "INFO"
    Write-Log "   Admin: admin / admin123" "INFO"
    Write-Log "   Cashier: cashier / cashier123" "INFO"
    Write-Log "   Courier: courier / courier123" "INFO"
    Write-Log ""
    Write-Log "⚠️  SECURITY: Change default passwords immediately!" "WARNING"
    Write-Log ""
    
    # Show container status
    Write-Log "📊 Container Status:" "INFO"
    docker compose -f docker-compose.production.yml ps
    
    Write-Log ""
    Write-Log "✅ Deployment complete! Highway Cafe POS is ready for use." "SUCCESS"
}

# Stop deployment function
function Stop-Deployment {
    Write-Log "Stopping Highway Cafe POS deployment..." "INFO"
    try {
        docker compose -f docker-compose.production.yml down
        Write-Log "Services stopped successfully" "SUCCESS"
    }
    catch {
        Write-Log "Error stopping services" "ERROR"
        exit 1
    }
}

# Show status function
function Show-Status {
    Write-Log "Highway Cafe POS Status:" "INFO"
    Write-Log "========================" "INFO"
    
    # Check if containers are running
    try {
        $containers = docker compose -f docker-compose.production.yml ps --format json | ConvertFrom-Json
        if ($containers) {
            Write-Log "Container Status:" "INFO"
            docker compose -f docker-compose.production.yml ps
            
            # Check health endpoint
            try {
                $response = Invoke-WebRequest -Uri "http://localhost:5000/health" -TimeoutSec 5 -UseBasicParsing
                if ($response.StatusCode -eq 200) {
                    Write-Log "✅ Application is healthy and responding" "SUCCESS"
                    Write-Log "🌐 Access: http://localhost:5000" "INFO"
                } else {
                    Write-Log "⚠️  Application responding but may have issues" "WARNING"
                }
            }
            catch {
                Write-Log "❌ Application not responding on port 5000" "ERROR"
            }
        } else {
            Write-Log "No containers are currently running" "INFO"
        }
    }
    catch {
        Write-Log "Docker Compose project not found or not running" "INFO"
    }
}

# Show logs function
function Show-Logs {
    Write-Log "Showing recent application logs:" "INFO"
    try {
        docker compose -f docker-compose.production.yml logs --tail=50 -f
    }
    catch {
        Write-Log "Unable to show logs. Check if containers are running." "ERROR"
    }
}

# Main script execution
try {
    # Change to script directory
    $scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
    Set-Location $scriptPath
    
    # Check prerequisites
    Test-Prerequisites
    
    # Execute requested action
    switch ($Action.ToLower()) {
        "deploy" { Start-Deployment }
        "start" { Start-Deployment }
        "stop" { Stop-Deployment }
        "status" { Show-Status }
        "logs" { Show-Logs }
        "restart" { 
            Stop-Deployment
            Start-Sleep -Seconds 5
            Start-Deployment
        }
        default {
            Write-Log "Usage: .\deploy-production.ps1 [deploy|start|stop|status|logs|restart]" "INFO"
            Write-Log "Options:" "INFO"
            Write-Log "  -Clean    : Clean previous deployment before starting" "INFO"
            Write-Log "  -SkipDocker : Skip Docker prerequisite checks" "INFO"
            exit 1
        }
    }
}
catch {
    Write-Log "Deployment failed with error: $_" "ERROR"
    exit 1
}