@echo off
setlocal EnableExtensions
color 0B
cls

echo.
echo ======================================================
echo.
echo              VALEO INTELLIGENT CAMERA
echo              AI Vision Control System
echo.
echo ======================================================
echo.
echo  Project : Industrial Camera Detection
echo  Platform: Node.js + Python AI
echo  AI      : YOLO + ResNet50
echo  Mode    : Local AI - No Roboflow dependency
echo.
echo  Creators:
echo     - Iyed Tababi
echo     - Samaher Ajimi
echo     - Hichem Ajina
echo.
echo ======================================================
echo.

set "SCRIPT_DIR=%~dp0"
set "SERVER_DIR=%SCRIPT_DIR%server"
set "VENV=%SCRIPT_DIR%.venv"
set "PYTHON_EXE=%VENV%\Scripts\python.exe"
set "YOLO_MODEL=%SERVER_DIR%\best.pt"
set "RESNET_MODEL=%SERVER_DIR%\resnet50_classification_best.pth"

REM ======================================================
REM 1. CHECK NODE.JS
REM ======================================================

echo [1/8] Checking Node.js...
echo.

where node >nul 2>&1

if errorlevel 1 (
    color 0C
    echo ERROR: Node.js is not installed.
    echo.
    echo Please install Node.js and restart this script.
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%i in ('node -v') do set "NODE_VERSION=%%i"

echo Node.js detected: %NODE_VERSION%
echo.

REM ======================================================
REM 2. CHECK NPM
REM ======================================================

echo [2/8] Checking npm...
echo.

where npm >nul 2>&1

if errorlevel 1 (
    color 0C
    echo ERROR: npm is not available.
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%i in ('npm -v') do set "NPM_VERSION=%%i"

echo npm detected: %NPM_VERSION%
echo.

REM ======================================================
REM 3. CHECK PYTHON
REM ======================================================

echo [3/8] Checking Python...
echo.

where python >nul 2>&1

if errorlevel 1 (
    color 0C
    echo ERROR: Python is not installed.
    echo.
    echo Please install Python 3 and restart this script.
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%i in ('python --version') do set "PYTHON_VERSION=%%i"

echo System Python detected: %PYTHON_VERSION%
echo.

REM ======================================================
REM 4. CREATE / CHECK VIRTUAL ENVIRONMENT
REM ======================================================

echo [4/8] Preparing Python virtual environment...
echo.

if not exist "%PYTHON_EXE%" (

    echo Python virtual environment not found.
    echo Creating:
    echo %VENV%
    echo.

    python -m venv "%VENV%"

    if errorlevel 1 (
        color 0C
        echo.
        echo ERROR: Failed to create Python virtual environment.
        echo.
        pause
        exit /b 1
    )

    echo.
    echo Virtual environment created successfully.
    echo.
)

if not exist "%PYTHON_EXE%" (
    color 0C
    echo ERROR: Python executable not found.
    echo.
    echo Expected:
    echo %PYTHON_EXE%
    echo.
    pause
    exit /b 1
)

echo Virtual environment:
echo %PYTHON_EXE%
echo.

"%PYTHON_EXE%" --version

if errorlevel 1 (
    color 0C
    echo.
    echo ERROR: Virtual environment Python is not working.
    echo.
    pause
    exit /b 1
)

echo.

REM ======================================================
REM 5. INSTALL PYTHON AI DEPENDENCIES
REM ======================================================

echo [5/8] Preparing local AI dependencies...
echo.

"%PYTHON_EXE%" -m ensurepip --upgrade >nul 2>&1

echo Updating pip...
echo.

"%PYTHON_EXE%" -m pip install --upgrade pip

if errorlevel 1 (
    color 0C
    echo.
    echo ERROR: pip update failed.
    echo.
    pause
    exit /b 1
)

echo.
echo Checking PyTorch, Torchvision, Ultralytics and Pillow...
echo.

"%PYTHON_EXE%" -c "import torch; import torchvision; import ultralytics; from PIL import Image; print('PyTorch:', torch.__version__); print('Torchvision:', torchvision.__version__); print('Ultralytics:', ultralytics.__version__); print('Pillow: OK')" > "%TEMP%\valeo_ai_check.txt" 2>&1

if errorlevel 1 (

    echo AI dependencies are missing or invalid.
    echo Installing required packages...
    echo.

    "%PYTHON_EXE%" -m pip install torch torchvision ultralytics pillow

    if errorlevel 1 (
        color 0C
        echo.
        echo ERROR: Python AI dependencies installation failed.
        echo.
        echo Required packages:
        echo - torch
        echo - torchvision
        echo - ultralytics
        echo - pillow
        echo.
        pause
        exit /b 1
    )

) else (

    echo AI dependencies already installed.
    echo.
    type "%TEMP%\valeo_ai_check.txt"
)

echo.

REM ======================================================
REM 6. CHECK AI MODELS
REM ======================================================

echo [6/8] Checking local AI models...
echo.

if not exist "%SERVER_DIR%" (
    color 0C
    echo ERROR: Server directory not found.
    echo.
    echo Expected:
    echo %SERVER_DIR%
    echo.
    pause
    exit /b 1
)

if not exist "%SERVER_DIR%\inference.py" (
    color 0C
    echo ERROR: inference.py not found.
    echo.
    echo Expected:
    echo %SERVER_DIR%\inference.py
    echo.
    pause
    exit /b 1
)

if not exist "%YOLO_MODEL%" (
    color 0C
    echo ERROR: YOLO model not found.
    echo.
    echo Expected:
    echo %YOLO_MODEL%
    echo.
    echo The file must be included with the project.
    echo.
    pause
    exit /b 1
)

if not exist "%RESNET_MODEL%" (
    color 0C
    echo ERROR: ResNet50 model not found.
    echo.
    echo Expected:
    echo %RESNET_MODEL%
    echo.
    echo The file must be included with the project.
    echo.
    pause
    exit /b 1
)

echo.
echo YOLO model found:
echo %YOLO_MODEL%
echo.

echo ResNet50 model found:
echo %RESNET_MODEL%
echo.

REM ======================================================
REM 7. TEST BOTH AI MODELS
REM ======================================================

echo [7/8] Testing AI models...
echo.

echo.
echo -----------------------------------------------
echo Testing YOLO model...
echo -----------------------------------------------
echo.

"%PYTHON_EXE%" -c "from ultralytics import YOLO; model=YOLO(r'%YOLO_MODEL%'); print('YOLO model loaded successfully.'); print('Classes:', model.names)"

if errorlevel 1 (
    color 0C
    echo.
    echo ERROR: YOLO model cannot be loaded.
    echo.
    pause
    exit /b 1
)

echo.
echo YOLO test: OK
echo.

echo.
echo -----------------------------------------------
echo Testing ResNet50 model...
echo -----------------------------------------------
echo.

"%PYTHON_EXE%" -c "import torch; checkpoint=torch.load(r'%RESNET_MODEL%', map_location='cpu'); assert isinstance(checkpoint, dict); assert 'model_state_dict' in checkpoint; assert 'classes' in checkpoint; assert 'num_classes' in checkpoint; print('ResNet50 model file loaded successfully.'); print('Classes:', checkpoint['classes']); print('Number of classes:', checkpoint['num_classes'])"

if errorlevel 1 (
    color 0C
    echo.
    echo ERROR: ResNet50 model cannot be loaded.
    echo.
    echo The model must contain:
    echo - model_state_dict
    echo - classes
    echo - num_classes
    echo.
    pause
    exit /b 1
)

echo.
echo ResNet50 test: OK
echo.

echo.
echo ======================================================
echo.
echo              AI ENVIRONMENT READY
echo.
echo              YOLO     : OK
echo              ResNet50 : OK
echo              Roboflow : NOT REQUIRED
echo.
echo ======================================================
echo.

REM ======================================================
REM 8. NODE.JS DEPENDENCIES + START SERVER
REM ======================================================

echo [8/8] Preparing Node.js application...
echo.

cd /d "%SERVER_DIR%"

if not exist "%SERVER_DIR%\package.json" (
    color 0C
    echo ERROR: package.json not found.
    echo.
    echo Expected:
    echo %SERVER_DIR%\package.json
    echo.
    pause
    exit /b 1
)

if not exist "%SERVER_DIR%\node_modules" (

    echo node_modules not found.
    echo Installing npm dependencies...
    echo.

    call npm install

    if errorlevel 1 (
        color 0C
        echo.
        echo ERROR: npm installation failed.
        echo.
        pause
        exit /b 1
    )

    echo.
    echo npm dependencies installed successfully.
    echo.
)

echo Node.js dependencies ready.
echo.

REM ======================================================
REM CHECK PORT 3000
REM ======================================================

echo Checking port 3000...
echo.

for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING" 2^>nul') do (
    echo Closing process PID %%P using port 3000...
    taskkill /PID %%P /F >nul 2>&1
)

echo.
echo ======================================================
echo.
echo              STARTING VALEO SERVER
echo.
echo ======================================================
echo.
echo  URL       : http://localhost:3000
echo  AI        : Local models
echo  YOLO      : Object Detection
echo  ResNet50  : Image Classification
echo  Roboflow  : Not required for inference
echo.
echo  Python    : %PYTHON_EXE%
echo.
echo  YOLO      : %YOLO_MODEL%
echo  ResNet50  : %RESNET_MODEL%
echo.
echo  Press CTRL+C to stop the server
echo.
echo ======================================================
echo.

REM ======================================================
REM START NODE.JS
REM ======================================================

node server.js

echo.
echo.
echo ======================================================
echo              VALEO SERVER STOPPED
echo ======================================================
echo.

pause
endlocal