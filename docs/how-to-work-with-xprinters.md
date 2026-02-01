# How to Work with XPrinters on Linux (Heavys ERP)

This document explains how to configure XPrinter POS-80 thermal receipt printers for use with Heavys ERP on Ubuntu/Lubuntu Linux.

## Overview

The XPrinter POS-80 is a thermal receipt printer commonly used in POS systems. It supports ESC/POS commands and connects via USB.

## Hardware Information

- **Manufacturer**: XPrinter
- **Model**: POS-80 (80mm thermal printer)
- **Connection**: USB
- **USB Vendor ID**: `0483` (STMicroelectronics)
- **USB Product ID**: `5743`
- **Device Path**: `/dev/usb/lp1` (or `/dev/usb/lp0`)

## Why the Standard CUPS Driver Doesn't Work

The standard XPrinter CUPS driver (`snailep-xprinter`) has issues:

1. **Filter crashes**: The `rastertosnailep-xprinter` filter crashes with signal 11 (segfault)
2. **Garbage output**: The driver converts text to raster graphics, which produces garbage characters
3. **Jobs get stuck**: Print jobs show "Stopped" status with "Filter failed" message

## The Solution: Direct USB Printing with ESC/POS

Instead of using CUPS drivers, we write directly to the USB device with ESC/POS commands.

### Step 1: Set Permanent USB Permissions

Create a udev rule to allow the application to write directly to the printer:

```bash
# Create the udev rule
echo 'SUBSYSTEM=="usb", ATTR{idVendor}=="0483", ATTR{idProduct}=="5743", MODE="0666"' | sudo tee /etc/udev/rules.d/99-xprinter.rules

# Reload udev rules
sudo udevadm control --reload-rules

# Also add user to lp group (requires logout/login)
sudo usermod -aG lp $USER
```

### Step 2: Printer Implementation

The printer module (`server/printer.ts`) uses:

1. **ESC/POS Commands**: Standard thermal printer control codes
2. **Direct USB Writing**: Writes to `/dev/usb/lp1` for fastest, most reliable printing
3. **Fallback to Raw Queue**: If direct USB fails, uses `lp -d Printer-POS-80-Raw`

Key ESC/POS Commands used:
```typescript
const ESC = '\x1b';
const GS = '\x1d';

INIT: ESC + '@'              // Initialize printer
ALIGN_CENTER: ESC + 'a\x01'  // Center alignment
ALIGN_LEFT: ESC + 'a\x00'    // Left alignment
BOLD_ON: ESC + 'E\x01'       // Bold text on
BOLD_OFF: ESC + 'E\x00'      // Bold text off
PARTIAL_CUT: GS + 'V\x01'    // Partial paper cut
FULL_CUT: GS + 'V\x00'       // Full paper cut
```

### Step 3: CUPS Configuration (Optional Fallback)

If direct USB doesn't work, you can use a Raw CUPS queue:

```bash
# Create a raw queue (bypasses driver filters)
lpadmin -p Printer-POS-80-Raw -E -v usb://Printer/POS-80?serial=YOUR_SERIAL -m raw

# Cancel stuck jobs
cancel -a Printer-POS-80

# Re-enable printer
cupsenable Printer-POS-80
cupsaccept Printer-POS-80

# After CUPS changes, restart CUPS
sudo systemctl restart cups
```

## Troubleshooting

### Printer connected but not printing

1. Check if device exists:
   ```bash
   ls -la /dev/usb/lp*
   lsusb | grep -i printer
   ```

2. Try manual ESC/POS test:
   ```bash
   echo -e '\x1b@Test Print\n\n\n\x1dV\x00' > /dev/usb/lp1
   ```

### Garbage characters on printout

This usually means the driver is converting text to raster. Solutions:
- Use direct USB writing (current implementation)
- Use Raw CUPS queue instead of driver queue
- Ensure ESC/POS INIT command (`\x1b@`) is sent first

### Jobs stuck with "Filter failed"

```bash
# Check CUPS error log
tail -100 /var/log/cups/error_log | grep -E "Job|filter|error"

# Cancel all stuck jobs
cancel -a Printer-POS-80

# Restart CUPS
sudo systemctl restart cups
```

### Permission denied on /dev/usb/lp1

```bash
# Temporary fix
sudo chmod 666 /dev/usb/lp1

# Permanent fix - create udev rule (see Step 1)
```

## Arabic Text Support

For Arabic text printing:
- The printer must support Arabic character sets
- Use UTF-8 encoding in the print data
- Some printers require specific code page selection commands
- ESC/POS command for Arabic code page: `ESC t n` where n is the code page number

## Files Modified

- `server/printer.ts` - Main printer implementation with ESC/POS and direct USB
- `server/routes.ts` - API endpoint `/api/print/receipt` (moved before return statement)
- `server/vite.ts` - Fixed catch-all handler to not intercept API routes
- `/etc/udev/rules.d/99-xprinter.rules` - Permanent USB permissions

## Testing

Run the test script to verify printing works:
```bash
npx tsx scripts/test-cashier-print.ts
```

## Service Restart

After any printer configuration changes:
```bash
sudo systemctl restart cups
systemctl restart heavys-erp
```
