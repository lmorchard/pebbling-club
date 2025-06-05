#!/bin/bash
set -e
echo "Starting uv verification subtask..."

# Ensure python3.11 is available or adjust as needed.
# Attempt to find a suitable python version if 3.11 is not directly available.
PYTHON_EXECUTABLE=$(which python3.11 || which python3 || echo "python")
echo "Using Python: $PYTHON_EXECUTABLE"

# 1. Create virtual environment using uv
echo "Creating virtual environment with uv..."
uv venv --python $PYTHON_EXECUTABLE .venv-test-uv
if [ ! -f ".venv-test-uv/bin/activate" ]; then
    echo "Failed to create virtual environment .venv-test-uv/bin/activate not found."
    # list files for debugging
    ls -la .venv-test-uv
    ls -la .venv-test-uv/bin
    exit 1
fi
echo "Virtual environment created."

# 2. Activate virtual environment
echo "Activating virtual environment..."
source .venv-test-uv/bin/activate
echo "Virtual environment activated."

# 3. Install dependencies using uv
echo "Attempting to install dependencies with uv pip sync..."
uv pip sync requirements.txt
echo "Dependencies installed."

# 4. Capture versions
echo "uv version:"
uv --version
echo "Django version:"
python -m django --version
echo "Successfully created venv and installed dependencies with uv."

# Deactivate and clean up
echo "Deactivating and cleaning up..."
deactivate
rm -rf .venv-test-uv
echo "Cleaned up test virtual environment."
echo "uv verification subtask completed."
