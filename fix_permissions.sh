#!/bin/bash
echo "Applying permissions..."
# Try lp1
echo "highway_cafe_123" | sudo -S chmod 666 /dev/usb/lp1
# Try lp0 just in case
echo "highway_cafe_123" | sudo -S chmod 666 /dev/usb/lp0 2>/dev/null

echo "Checking result:"
ls -l /dev/usb/lp*
