#!/bin/bash
echo "Building Highway Cafe POS Client for Linux..."

# Install dependencies if needed
npm install

# Build and Pack
npm run pack:linux

echo "Build Complete! Check the 'release' folder for the AppImage."
