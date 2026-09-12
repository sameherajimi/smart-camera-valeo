#!/bin/bash

# ================================================================
# VALEO INTELLIGENT CAMERA
# AI Vision Control System
# Deployment Launcher
# ================================================================

GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
BLUE="\033[0;34m"
CYAN="\033[0;36m"
WHITE="\033[1;37m"
NC="\033[0m"

clear

echo -e "${CYAN}"
echo "============================================================"
echo
echo "             VALEO INTELLIGENT CAMERA"
echo "             AI Vision Control System"
echo
echo "============================================================"
echo -e "${WHITE}"
echo
echo " Project : Industrial Camera Detection"
echo " Platform: Node.js + Python AI"
echo
echo "============================================================"
echo -e "${NC}"

# ================================================================
# [1/8] PROJECT PATH
# ================================================================

echo -e "${YELLOW}[1/8] Checking project paths...${NC}"
echo

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"
VENV="$SCRIPT_DIR/.venv"
PYTHON_EXE="$VENV/bin/python"

echo "Project directory:"
echo "$SCRIPT_DIR"
echo

if [ ! -d "$SERVER_DIR" ]; then
    echo -e "${RED}ERROR: Server directory not found:${NC}"
    echo "$SERVER_DIR"
    exit 1
fi

echo -e "${GREEN}OK - Server directory found.${NC}"
echo

# ================================================================
# [2/8] CHECK NODE.JS
# ================================================================

echo -e "${YELLOW}[2/8] Checking Node.js...${NC}"
echo

if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}ERROR: Node.js is not installed or not available in PATH.${NC}"
    exit 1
fi

node --version

if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Node.js cannot be executed.${NC}"
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    echo -e "${RED}ERROR: npm is not available.${NC}"
    exit 1
fi

npm --version

if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: npm cannot be executed.${NC}"
    exit 1
fi

echo
echo -e "${GREEN}OK - Node.js and npm are available.${NC}"
echo

# ================================================================
# [3/8] CHECK PYTHON 3.12
# ================================================================

echo -e "${YELLOW}[3/8] Checking Python 3.12...${NC}"
echo

PYTHON_CMD=""

if command -v python3.12 >/dev/null 2>&1; then
    PYTHON_CMD="python3.12"
elif command -v python3 >/dev/null 2>&1; then
    PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null)

    if [ "$PYTHON_VERSION" = "3.12" ]; then
        PYTHON_CMD="python3"
    fi
fi

if [ -z "$PYTHON_CMD" ]; then
    echo -e "${RED}ERROR: Python 3.12 NOT FOUND.${NC}"
    echo
    echo "Please install Python 3.12."
    exit 1
fi

echo -e "${GREEN}OK - Python 3.12 detected.${NC}"
$PYTHON_CMD --version
echo

# ================================================================
# [4/8] CREATE / CHECK VIRTUAL ENVIRONMENT
# ================================================================

echo -e "${YELLOW}[4/8] Checking virtual environment...${NC}"
echo

if [ -f "$PYTHON_EXE" ]; then
    echo -e "${GREEN}OK - Existing virtual environment found.${NC}"
else
    echo "Virtual environment not found."
    echo "Creating:"
    echo "$VENV"
    echo

    $PYTHON_CMD -m venv "$VENV"

    if [ $? -ne 0 ]; then
        echo -e "${RED}ERROR: Failed to create Python virtual environment.${NC}"
        exit 1
    fi
fi

if [ ! -f "$PYTHON_EXE" ]; then
    echo -e "${RED}ERROR: Virtual environment Python was not found.${NC}"
    echo "$PYTHON_EXE"
    exit 1
fi

echo
echo "Python environment:"
echo "$PYTHON_EXE"
echo

"$PYTHON_EXE" --version

if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Virtual environment Python cannot be executed.${NC}"
    exit 1
fi

echo
echo -e "${GREEN}OK - Virtual environment ready.${NC}"
echo

# ================================================================
# [5/8] INSTALL PYTHON DEPENDENCIES
# ================================================================

echo -e "${YELLOW}[5/8] Checking Python AI dependencies...${NC}"
echo

echo "Upgrading pip..."
"$PYTHON_EXE" -m pip install --upgrade pip

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}WARNING: pip upgrade failed. Continuing...${NC}"
fi

echo
echo "Checking PyTorch..."

if "$PYTHON_EXE" -c "import torch; print('PyTorch OK - version:', torch.__version__)" >/dev/null 2>&1; then
    echo -e "${GREEN}OK - PyTorch already installed.${NC}"
else
    echo "PyTorch not installed."
    echo "Installing PyTorch..."
    echo

    "$PYTHON_EXE" -m pip install torch torchvision

    if [ $? -ne 0 ]; then
        echo -e "${RED}ERROR: PyTorch installation failed.${NC}"
        exit 1
    fi
fi

echo
echo "Checking torchvision..."

if "$PYTHON_EXE" -c "import torchvision" >/dev/null 2>&1; then
    echo -e "${GREEN}OK - torchvision already installed.${NC}"
else
    echo "torchvision not installed."
    echo "Installing torchvision..."
    echo

    "$PYTHON_EXE" -m pip install torchvision

    if [ $? -ne 0 ]; then
        echo -e "${RED}ERROR: torchvision installation failed.${NC}"
        exit 1
    fi
fi

echo
echo "Checking Ultralytics..."

if "$PYTHON_EXE" -c "import ultralytics" >/dev/null 2>&1; then
    echo -e "${GREEN}OK - Ultralytics already installed.${NC}"
else
    echo "Ultralytics not installed."
    echo "Installing Ultralytics..."
    echo

    "$PYTHON_EXE" -m pip install ultralytics

    if [ $? -ne 0 ]; then
        echo -e "${RED}ERROR: Ultralytics installation failed.${NC}"
        exit 1
    fi
fi

echo
echo "Checking Pillow..."

if "$PYTHON_EXE" -c "from PIL import Image" >/dev/null 2>&1; then
    echo -e "${GREEN}OK - Pillow already installed.${NC}"
else
    echo "Pillow not installed."
    echo "Installing Pillow..."
    echo

    "$PYTHON_EXE" -m pip install pillow

    if [ $? -ne 0 ]; then
        echo -e "${RED}ERROR: Pillow installation failed.${NC}"
        exit 1
    fi
fi

echo
echo "Checking OpenCV..."

if "$PYTHON_EXE" -c "import cv2" >/dev/null 2>&1; then
    echo -e "${GREEN}OK - OpenCV already installed.${NC}"
else
    echo "OpenCV not installed."
    echo "Installing OpenCV..."
    echo

    "$PYTHON_EXE" -m pip install opencv-python

    if [ $? -ne 0 ]; then
        echo -e "${RED}ERROR: OpenCV installation failed.${NC}"
        exit 1
    fi
fi

echo
echo "Checking NumPy..."

if "$PYTHON_EXE" -c "import numpy" >/dev/null 2>&1; then
    echo -e "${GREEN}OK - NumPy already installed.${NC}"
else
    echo "NumPy not installed."
    echo "Installing NumPy..."
    echo

    "$PYTHON_EXE" -m pip install numpy

    if [ $? -ne 0 ]; then
        echo -e "${RED}ERROR: NumPy installation failed.${NC}"
        exit 1
    fi
fi

echo
echo "============================================================"
echo -e "${GREEN}Python AI dependencies ready.${NC}"
echo "============================================================"
echo

# ================================================================
# [6/8] CHECK PROJECT FILES
# ================================================================

echo -e "${YELLOW}[6/8] Checking project files...${NC}"
echo

if [ ! -f "$SERVER_DIR/server.js" ]; then
    echo -e "${RED}ERROR: server.js not found.${NC}"
    echo "$SERVER_DIR/server.js"
    exit 1
fi

echo -e "${GREEN}OK - server.js${NC}"

if [ ! -f "$SERVER_DIR/inference.py" ]; then
    echo -e "${RED}ERROR: inference.py not found.${NC}"
    echo "$SERVER_DIR/inference.py"
    exit 1
fi

echo -e "${GREEN}OK - inference.py${NC}"

if [ ! -f "$SERVER_DIR/best.pt" ]; then
    echo -e "${RED}ERROR: YOLO model not found.${NC}"
    echo "$SERVER_DIR/best.pt"
    exit 1
fi

echo -e "${GREEN}OK - best.pt${NC}"

if [ ! -f "$SERVER_DIR/resnet50_classification_best.pth" ]; then
    echo -e "${RED}ERROR: ResNet50 model not found.${NC}"
    echo "$SERVER_DIR/resnet50_classification_best.pth"
    exit 1
fi

echo -e "${GREEN}OK - resnet50_classification_best.pth${NC}"

echo
echo -e "${GREEN}All required project files found.${NC}"
echo

# ================================================================
# [7/8] TEST AI MODELS
# ================================================================

echo -e "${YELLOW}[7/8] Testing AI models...${NC}"
echo

echo "------------------------------------------------------------"
echo "Testing PyTorch"
echo "------------------------------------------------------------"

"$PYTHON_EXE" -c "import torch; print('Torch version:', torch.__version__); print('CUDA available:', torch.cuda.is_available())"

if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: PyTorch test failed.${NC}"
    exit 1
fi

echo
echo "------------------------------------------------------------"
echo "Testing Ultralytics / YOLO"
echo "------------------------------------------------------------"

"$PYTHON_EXE" -c "from ultralytics import YOLO; model=YOLO('$SERVER_DIR/best.pt'); print('YOLO model loaded successfully'); print('Classes:', model.names)"

if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: YOLO model could not be loaded.${NC}"
    echo "$SERVER_DIR/best.pt"
    exit 1
fi

echo
echo "------------------------------------------------------------"
echo "Testing ResNet50"
echo "------------------------------------------------------------"

"$PYTHON_EXE" -c "import torch; p='$SERVER_DIR/resnet50_classification_best.pth'; c=torch.load(p,map_location='cpu'); assert isinstance(c,dict); assert 'model_state_dict' in c; assert 'classes' in c; assert 'num_classes' in c; print('ResNet50 checkpoint loaded successfully'); print('Classes:', c['classes']); print('Number of classes:', c['num_classes'])"

if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: ResNet50 model could not be loaded.${NC}"
    echo "$SERVER_DIR/resnet50_classification_best.pth"
    exit 1
fi

echo
echo "============================================================"
echo -e "${GREEN}AI MODELS READY${NC}"
echo "============================================================"
echo

# ================================================================
# [8/8] NODE.JS DEPENDENCIES + START SERVER
# ================================================================

echo -e "${YELLOW}[8/8] Preparing Node.js server...${NC}"
echo

cd "$SERVER_DIR" || {
    echo -e "${RED}ERROR: Cannot access server directory.${NC}"
    exit 1
}

echo "Current directory:"
pwd
echo

if [ ! -f "package.json" ]; then
    echo -e "${RED}ERROR: package.json not found.${NC}"
    exit 1
fi

echo -e "${GREEN}package.json found.${NC}"
echo

if [ ! -d "node_modules" ]; then
    echo "node_modules not found."
    echo "Installing Node.js dependencies..."
    echo

    npm install

    if [ $? -ne 0 ]; then
        echo -e "${RED}ERROR: npm install failed.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}OK - node_modules already exists.${NC}"
fi

echo
echo "============================================================"
echo "              STARTING VALEO SMART CAMERA"
echo "============================================================"
echo
echo "Python:"
echo "$PYTHON_EXE"
echo
echo "Server:"
echo "$SERVER_DIR/server.js"
echo
echo "YOLO:"
echo "$SERVER_DIR/best.pt"
echo
echo "ResNet50:"
echo "$SERVER_DIR/resnet50_classification_best.pth"
echo
echo "============================================================"
echo
echo "Roboflow dependency: DISABLED"
echo "Local AI models: ENABLED"
echo
echo "URL: http://localhost:3000"
echo
echo "============================================================"
echo

export VALEO_PYTHON="$PYTHON_EXE"

echo "VALEO_PYTHON:"
echo "$VALEO_PYTHON"
echo

# ================================================================
# OPEN GOOGLE CHROME AUTOMATICALLY
# ================================================================

echo "Opening Google Chrome..."

(
    sleep 3

    if command -v google-chrome >/dev/null 2>&1; then
        google-chrome "http://localhost:3000" >/dev/null 2>&1 &
    elif command -v google-chrome-stable >/dev/null 2>&1; then
        google-chrome-stable "http://localhost:3000" >/dev/null 2>&1 &
    elif command -v chromium >/dev/null 2>&1; then
        chromium "http://localhost:3000" >/dev/null 2>&1 &
    elif command -v chromium-browser >/dev/null 2>&1; then
        chromium-browser "http://localhost:3000" >/dev/null 2>&1 &
    elif command -v xdg-open >/dev/null 2>&1; then
        xdg-open "http://localhost:3000" >/dev/null 2>&1 &
    fi
) &

echo "Starting Node.js server..."
echo

node server.js

echo
echo "============================================================"
echo "SERVER STOPPED"
echo "============================================================"
echo