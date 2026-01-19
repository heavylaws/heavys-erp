#!/bin/bash
echo "--- EMERGENCY STOP ---"
cancel -a
sudo lpadmin -x Xprinter_XP80T 2>/dev/null
echo "Cleared print queue."

echo "--- INSTALLING DRIVERS ---"
sudo apt-get update
sudo apt-get install -y printer-driver-escpos cups-ppdc

echo "--- SETUP PRINTER ---"
# Look for an ESC/POS 80mm driver
# The logic: Get all drivers, grep for 'escpos', then '80' or partition to find best match
# We extract the first column (URI)

# Try 1: Explicit Generic ESC/POS
DRIVER=$(lpinfo -m | grep -i "escpos" | grep -i "80mm" | awk '{print $1}' | head -n 1)

# Try 2: Epson TM-T88 (Compatible)
if [ -z "$DRIVER" ]; then
    DRIVER=$(lpinfo -m | grep -i "T88" | grep -v "Raw" | awk '{print $1}' | head -n 1)
fi

# Try 3: Text Only (if installed by cups-ppdc)
if [ -z "$DRIVER" ]; then
    DRIVER=$(lpinfo -m | grep "textonly" | awk '{print $1}' | head -n 1)
fi

if [ -n "$DRIVER" ]; then
    echo "Found Driver: $DRIVER"
    sudo lpadmin -p Xprinter_XP80T -v "usb://Printer/POS-80?serial=1C5A60DA0000" -E -m "$DRIVER"
    echo "Printer installed with high-quality driver."
else
    echo "Could not find a graphical driver. Falling back to Raw."
    echo "NOTE: With Raw driver, you MUST use 'Print using system dialog' in Chrome."
    sudo lpadmin -p Xprinter_XP80T -v "usb://Printer/POS-80?serial=1C5A60DA0000" -E -m raw
fi

echo "Done. Please try printing again."
