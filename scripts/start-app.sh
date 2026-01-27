#!/bin/bash

# Heavys ERP Launcher
# This script starts the backend server if needed and then launches the Electron POS client.

# Navigate to the project root
cd "/home/sc/heavys-erp"

echo "Checking if Heavys ERP server is running..."

# Check if port 5003 is already in use
if lsof -Pi :5003 -sTCP:LISTEN -t >/dev/null ; then
    echo "Server is already running on port 5003."
else
    echo "Starting Heavys ERP server in the background..."
    # Start the server and redirect output to a log file
    npm run dev > server.log 2>&1 &
    
    # Wait for the server to be ready
    echo "Waiting for server to initialize..."
    attempt_counter=0
    max_attempts=30
    until $(curl --output /dev/null --silent --head --fail http://localhost:5003/api/health); do
        if [ ${attempt_counter} -eq ${max_attempts} ];then
          echo "Max attempts reached. Server might have failed to start. Check server.log"
          exit 1
        fi

        printf '.'
        attempt_counter=$(($attempt_counter+1))
        sleep 1
    done
    echo " Server is ready!"
fi

echo "Launching POS client..."
export POS_URL=http://localhost:5003

# Check if Electron is already running (simple check)
if pgrep -f "electron" > /dev/null; then
    echo "Heavys ERP client appears to be already running."
else
    npm run electron
fi
