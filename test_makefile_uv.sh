#!/bin/bash
set -e
echo "--- Starting Makefile Tests with uv (Direct Execution) ---"

# Clean up existing virtual environment if it exists
if [ -d "venv" ]; then
  echo "Removing existing virtual environment..."
  rm -rf venv
fi

# Backup requirements.txt
if [ -f "requirements.txt" ]; then
  cp requirements.txt requirements.txt.bak-testing
fi

echo "Running 'make venv/bin/activate' to create venv and install deps with uv..."
make venv/bin/activate
if [ ! -f "venv/bin/activate" ]; then
    echo "ERROR: 'make venv/bin/activate' failed to create the virtual environment."
    if [ -f "requirements.txt.bak-testing" ]; then
      mv requirements.txt.bak-testing requirements.txt
    fi
    exit 1
fi
echo "'make venv/bin/activate' completed."
# Ensure the venv is activated for subsequent commands in this script's context
source venv/bin/activate

echo "Running 'make test'..."
make test
echo "'make test' completed."

# Deactivate before freeze to ensure it captures the environment state correctly
# as if run in a fresh shell. The Makefile's freeze target should reactivate.
deactivate

echo "Running 'make freeze' to update requirements.txt with uv..."
make freeze
if ! grep -q "Django==" requirements.txt; then
    echo "ERROR: 'make freeze' did not seem to generate a valid requirements.txt (missing Django)."
    cat requirements.txt # Show content for debugging
    if [ -f "requirements.txt.bak-testing" ]; then
      mv requirements.txt.bak-testing requirements.txt # Restore original
    fi
    exit 1
fi
echo "'make freeze' completed and requirements.txt seems valid."

# Reactivate for the serve test
source venv/bin/activate

echo "Running 'make serve' to test if the development server can start..."
make serve &
SERVE_PID=$!
echo "Launched server with PID $SERVE_PID. Waiting for 10 seconds..."
sleep 10 # Let it run for a bit to catch startup errors

echo "Checking if server process $SERVE_PID is still running..."
if ps -p $SERVE_PID > /dev/null; then
   echo "Server process is running. Killing it now."
   kill $SERVE_PID
   # Wait for the process to be killed
   wait $SERVE_PID || true
   echo "Server process $SERVE_PID killed."
else
   echo "ERROR: Server process $SERVE_PID did not start or died prematurely."
   if [ -f "requirements.txt.bak-testing" ]; then
     mv requirements.txt.bak-testing requirements.txt # Restore original
   fi
   exit 1
fi
echo "'make serve' test completed."

# Restore original requirements.txt
if [ -f "requirements.txt.bak-testing" ]; then
  echo "Restoring original requirements.txt..."
  mv requirements.txt.bak-testing requirements.txt
fi

# Clean up venv
if [ -d "venv" ]; then
  echo "Removing virtual environment..."
  rm -rf venv
fi

echo "--- Makefile Tests with uv (Direct Execution) Successful ---"
