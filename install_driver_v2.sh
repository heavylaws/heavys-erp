#!/bin/bash
echo "Installing Gutenprint drivers..."
sudo apt-get update
sudo apt-get install -y printer-driver-gutenprint

echo "Searching for best driver..."
# 1. Look for Generic Text Only (comes with standard CUPS usually, but maybe Gutenprint adds it)
DRIVER=$(lpinfo -m | grep "textonly")

# 2. Look for Epson TM-T88 (Gutenprint)
if [ -z "$DRIVER" ]; then
    DRIVER=$(lpinfo -m | grep -i "T88" | head -n 1 | awk '{print $1}')
fi

# 3. Look for "Generic PCL" isn't good but better than Raw? No.
# 4. Fallback to Raw but warn user.

if [ -n "$DRIVER" ]; then
    echo "Found Driver: $DRIVER"
    sudo lpadmin -p Xprinter_XP80T -v "usb://Printer/POS-80?serial=1C5A60DA0000" -E -m "$DRIVER"
    echo "Printer installed successfully with graphics support!"
else
    echo "Still cannot find a graphical driver."
    echo "Installing as Raw. You MUST use 'Print using system dialog' (Ctrl+Shift+P) in Chrome."
    sudo lpadmin -p Xprinter_XP80T -v "usb://Printer/POS-80?serial=1C5A60DA0000" -E -m raw
fi
echo "Done."
