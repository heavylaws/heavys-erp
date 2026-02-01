#!/bin/bash
set -e

PPD_FILE="/etc/cups/ppd/Xprinter-XP-236B.ppd"
BACKUP_FILE="/etc/cups/ppd/Xprinter-XP-236B.ppd.bak_$(date +%s)"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo ./update_printer.sh)"
  exit 1
fi

if [ ! -f "$PPD_FILE" ]; then
    echo "Error: PPD file not found at $PPD_FILE"
    exit 1
fi

echo "Backing up PPD to $BACKUP_FILE..."
cp "$PPD_FILE" "$BACKUP_FILE"

# Define the new sizes (Points: 1mm = 2.83465 pt)
# 40mm x 30mm = 113.39 x 85.04 -> 113 85
# 58mm x 30mm = 164.41 x 85.04 -> 164 85

# Function to insert lines if they don't exist
add_param() {
    local anchor="$1"
    local new_line="$2"
    
    if grep -Fq "$new_line" "$PPD_FILE"; then
        echo "Entry '$new_line' already exists."
    else
        # Insert after the anchor (last occurrence)
        sed -i "/$anchor/a $new_line" "$PPD_FILE"
        echo "Added: $new_line"
    fi
}

# 1. PageSize
# Insert after the common 4x6 size or the Custom entry
ANCHOR_PS="*PageSize w4h6"
add_param "$ANCHOR_PS" '*PageSize Label40x30/40mm x 30mm: "<</PageSize[113 85]/ImagingBBox null>>setpagedevice"'
add_param "$ANCHOR_PS" '*PageSize Label58x30/58mm x 30mm: "<</PageSize[164 85]/ImagingBBox null>>setpagedevice"'

# 2. ImageableArea
ANCHOR_IA="*ImageableArea w4h6"
add_param "$ANCHOR_IA" '*ImageableArea Label40x30/40mm x 30mm: "0 0 113 85"'
add_param "$ANCHOR_IA" '*ImageableArea Label58x30/58mm x 30mm: "0 0 164 85"'

# 3. PaperDimension
ANCHOR_PD="*PaperDimension w4h6"
add_param "$ANCHOR_PD" '*PaperDimension Label40x30/40mm x 30mm: "113 85"'
add_param "$ANCHOR_PD" '*PaperDimension Label58x30/58mm x 30mm: "164 85"'


# ---------------------------------------------------------
# XP-80T Receipt Printer Setup
# ---------------------------------------------------------

echo "Checking for XP-80T Receipt Printer..."

# Attempt to find connected USB printer ID for Xprinter
# This is a guess at the vid:pid text, but lpinfo -v will show it.
# We'll just guide the user or attempt generic setup.

# Function to add receipt printer with Generic ESC/POS driver if available, else Raw
setup_receipt_printer() {
    local PRINTER_NAME="Xprinter_XP-80T"
    
    # Check if already exists
    if lpstat -p "$PRINTER_NAME" &>/dev/null; then
        echo "Printer $PRINTER_NAME already exists."
    else
        echo "Adding $PRINTER_NAME..."
        # Try to find the URI (very naive, assumes only one USB printer or user picks)
        # We'll list devices and ask user, or just warn.
        echo "Available USB printers:"
        lpinfo -v | grep usb
        
        echo "To add this printer securely, please use the system settings or CUPS web interface (http://localhost:631)."
        echo "Recommended Driver: Generic -> ESC/POS -> EPSON TM-T88V (works well for most 80mm)"
        echo "Or install standard Xprinter Linux drivers manually."
    fi
}

setup_receipt_printer

echo "Restarting CUPS..."
service cups restart

echo "Done! Please refresh your browser print dialog."
