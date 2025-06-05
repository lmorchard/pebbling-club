#!/bin/bash
set -e
echo "--- Starting Basic uv Functionality Check ---"

# Define a temporary venv name
VENV_NAME=".venv-uv-direct-check"

# Clean up any pre-existing venv with the same name
rm -rf "$VENV_NAME"

# Attempt to use python3.11, fallback to python3, then python
PYTHON_CMD=$(which python3.11 || which python3 || echo "python")
echo "Using Python interpreter: $($PYTHON_CMD --version)"

# 1. Create a virtual environment with uv
echo "Attempting to create venv '$VENV_NAME' with 'uv venv'..."
uv venv --python $PYTHON_CMD "$VENV_NAME"
if [ ! -f "$VENV_NAME/bin/activate" ]; then
    echo "ERROR: Failed to create virtual environment. Activate script not found."
    exit 1
fi
echo "Virtual environment '$VENV_NAME' created successfully."

# 2. Activate and install a single small package (e.g., 'requests')
echo "Activating venv and installing 'requests'..."
source "$VENV_NAME/bin/activate"
uv pip install requests
echo "'requests' package installation attempted."

# 3. Verify package installation
echo "Verifying 'requests' installation..."
python -c "import requests; print(f'Successfully imported requests version: {requests.__version__}')"
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to import 'requests' after installation."
    exit 1
fi
echo "'requests' imported successfully."

# 4. Check uv version
echo "uv version:"
uv --version

# Clean up
echo "Cleaning up virtual environment '$VENV_NAME'..."
deactivate
rm -rf "$VENV_NAME"
echo "Cleanup complete."
echo "--- Basic uv Functionality Check Successful ---"
