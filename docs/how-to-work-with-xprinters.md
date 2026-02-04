# How to Work with XPrinters on Linux (Heavys ERP)

This document explains how to configure XPrinter POS-80 thermal receipt printers for use with Heavys ERP on Ubuntu/Lubuntu Linux.

## Overview

The XPrinter POS-80 is a thermal receipt printer commonly used in POS systems. It supports ESC/POS commands but has limited internal fonts.

## Hardware Information

- **Manufacturer**: XPrinter
- **Model**: POS-80 (80mm thermal printer)
- **USB Vendor ID**: `0483` (STMicroelectronics)
- **USB Product ID**: `5743`
- **Device Path**: `/dev/usb/lp1` (or `/dev/usb/lp0`)

## The Problem: Arabic Text & Driver Issues

1.  **Missing Arabic Fonts**: The printer does not have built-in Arabic fonts. Sending UTF-8 Arabic text causes it to print Chinese characters (interpreting the bytes as GBK encoding).
2.  **Driver Crashes**: The standard CUPS driver (`snailep-xprinter`) often crashes (`rastertosnailep-xprinter` segfaults), causing jobs to get stuck as "Stopped".

## The Solution: Bitmap/Raster Printing

To support Arabic text reliably, we must bypass the printer's internal fonts and the faulty CUPS driver filters. We do this by rendering the receipt as an image (bitmap) on the server and sending the pixel data to the printer.

### 1. Implementation Architecture

-   **Image Rendering**: Use `canvas` (Node.js library) to draw the receipt layout, text, and styling programmatically.
-   **Arabic Reshaping**: Use `arabic-persian-reshaper` to fix Arabic ligatures and reverse the text for correct Right-to-Left (RTL) rendering on the canvas.
-   **Direct USB Writing**: Send the raw ESC/POS raster commands directly to the USB device file (`/dev/usb/lp1`) to avoid CUPS processing overhead/errors.

### 2. Dependencies

Required Node.js packages:

```json
"dependencies": {
  "canvas": "^2.11.2",
  "arabic-persian-reshaper": "^1.0.1"
}
```

### 3. Setup Instructions

#### A. System Prerequisites

The `canvas` package requires system libraries:

```bash
sudo apt-get update
sudo apt-get install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

#### B. Permanent USB Permissions

Create a udev rule to allow the application to write directly to the printer without root (sudo):

```bash
# Create the udev rule
echo 'SUBSYSTEM=="usb", ATTR{idVendor}=="0483", ATTR{idProduct}=="5743", MODE="0666"' | sudo tee /etc/udev/rules.d/99-xprinter.rules

# Reload udev rules
sudo udevadm control --reload-rules
```

#### C. CUPS Configuration (Fallback Only)

We primarily write directly to `/dev/usb/lp1`. However, a "Raw" CUPS queue is useful as a fallback or for testing connection:

```bash
# Create a raw queue (bypasses driver filters)
lpadmin -p Printer-POS-80-Raw -E -v usb://Printer/POS-80?serial=YOUR_SERIAL -m raw
```

### 4. Code Example

See `server/printer.ts` for the full implementation. Key logic involves:

1.  **Reshaping Text**:
    ```typescript
    const reshaped = ArabicReshaper.convert(text);
    const final = reshaped.split('').reverse().join(''); // For manual RTL drawing
    ```

2.  **Drawing to Canvas**:
    ```typescript
    const canvas = createCanvas(576, height); // 576 dots = 80mm
    const ctx = canvas.getContext('2d');
    ctx.fillText(final, x, y);
    ```

3.  **Raster Conversion**:
    Scanning the canvas pixels and converting them to `GS v 0` ESC/POS commands (Monochrome).

## Troubleshooting

### Printer prints gibberish/Chinese
-   **Cause**: You are likely sending raw text instead of a bitmap.
-   **Fix**: Ensure `renderReceiptToBuffer` is being called and the output is ESC/POS raster data.

### Permission Denied on `/dev/usb/lp1`
-   **Cause**: User is not in `lp` group or udev rule is missing.
-   **Fix**: Run the udev rule command above and restart.

### "Canvas" install fails
-   **Cause**: Missing system build tools.
-   **Fix**: Install `libcairo2-dev` and related packages (see Prerequisites).
