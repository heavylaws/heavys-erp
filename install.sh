#!/bin/bash

# HIGHWAY CAFE POS - CLIENT INSTALLER (Master Script)
# Run this on the NEW Client Machine (Linux Mint/Ubuntu)

APP_NAME="Highway Cafe POS"
INSTALL_DIR="/opt/highway-pos"
APP_IMAGE_NAME="Highway Cafe POS-1.0.0.AppImage"
SERVER_IP="192.168.1.104"
PRINTER_VENDOR="0483"
PRINTER_PRODUCT="5743"

echo "============================================"
echo "Installing $APP_NAME Client"
echo "Target Server: $SERVER_IP"
echo "============================================"

# Check for sudo
if [ "$EUID" -ne 0 ]; then 
  echo "Please run as root (sudo ./install-pos-client.sh)"
  exit
fi

# 1. Install Dependencies
echo "[1/4] Installing Dependencies (libusb, etc)..."
apt-get update
# Try to install libasound2t64 first (for newer Mint/Ubuntu), fallback to libasound2
if apt-cache show libasound2t64 >/dev/null 2>&1; then
    ASOUND_PKG="libasound2t64"
else
    ASOUND_PKG="libasound2"
fi

apt-get install -y libusb-1.0-0 libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libgtk-3-0 libgbm1 $ASOUND_PKG || apt-get install -y -f

# 2. Configure Printer Permissions (The "Hole" Fix)
echo "[2/4] Configuring Printer Permissions (Udev Rules)..."
RULE_FILE="/etc/udev/rules.d/99-xprinter.rules"
echo "SUBSYSTEM==\"usb\", ATTR{idVendor}==\"$PRINTER_VENDOR\", ATTR{idProduct}==\"$PRINTER_PRODUCT\", MODE=\"0666\", GROUP=\"lp\"" > $RULE_FILE
# Also add generic rule for any printer just in case
echo 'SUBSYSTEM=="usb", ATTRS{bInterfaceClass}=="07", MODE="0666", GROUP="lp"' >> $RULE_FILE

# Reload rules
udevadm control --reload-rules
udevadm trigger

# Add current user (SUDO_USER) to lp group
if [ -n "$SUDO_USER" ]; then
    echo "Adding user $SUDO_USER to printer group..."
    usermod -a -G lp $SUDO_USER
fi

# 3. Install the AppImage
echo "[3/4] Installing Application to $INSTALL_DIR..."
mkdir -p $INSTALL_DIR

# Check if AppImage exists, if not, try to download it
if [ ! -f "./$APP_IMAGE_NAME" ]; then
    echo "AppImage not found locally. Attempting to download from server..."
    if command -v wget >/dev/null 2>&1; then
        wget "http://$SERVER_IP:5000/api/installer/app" -O "$INSTALL_DIR/$APP_IMAGE_NAME"
    elif command -v curl >/dev/null 2>&1; then
        curl "http://$SERVER_IP:5000/api/installer/app" -o "$INSTALL_DIR/$APP_IMAGE_NAME"
    else
        echo "Error: Neither wget nor curl found. Cannot download AppImage."
        exit 1
    fi
else
    cp "./$APP_IMAGE_NAME" "$INSTALL_DIR/$APP_IMAGE_NAME"
fi

if [ ! -f "$INSTALL_DIR/$APP_IMAGE_NAME" ]; then
    echo "ERROR: Failed to install AppImage."
    exit 1
fi

chmod +x "$INSTALL_DIR/$APP_IMAGE_NAME"

# 4. Create Desktop Shortcut
echo "[4/4] Creating Desktop Shortcut..."
SHORTCUT_PATH="/usr/share/applications/highway-pos.desktop"
cat > $SHORTCUT_PATH <<EOF
[Desktop Entry]
Name=$APP_NAME
Exec=$INSTALL_DIR/"$APP_IMAGE_NAME"
Icon=$INSTALL_DIR/icon.png
Type=Application
Categories=Office;
Environment="POS_URL=http://$SERVER_IP:5000"
EOF

# Make it executable
chmod +x $SHORTCUT_PATH

echo "============================================"
echo "INSTALLATION COMPLETE!"
echo "1. Please unplug and replug the USB printer."
echo "2. Reboot is recommended to ensure permissions take effect."
echo "3. You can launch the app from the Start Menu."
echo "============================================"
