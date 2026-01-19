#!/bin/bash
echo "Re-installing Xprinter XP-80T..."

# Remove if exists
sudo lpadmin -x Xprinter_XP80T 2>/dev/null

# Add new (using Raw is still best for POS apps sending ESC/POS commands)
sudo lpadmin -p Xprinter_XP80T -v "usb://Printer/POS-80?serial=1C5A60DA0000" -E -m raw

# Set as default
sudo lpadmin -d Xprinter_XP80T

echo "Printer 'Xprinter_XP80T' re-installed and set as default."
echo "IMPORTANT: In Chrome, if you see 'Not available', please click 'Print using system dialog' at the bottom (Ctrl+Shift+P)."
