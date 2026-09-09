@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ============================================================
REM VALEO INTELLIGENT CAMERA
REM AI Vision Control System
REM Deployment Launcher
REM ============================================================

color 0B
title VALEO Intelligent Camera - AI Vision Control System
cls

echo.
echo ============================================================
echo.
echo              VALEO INTELLIGENT CAMERA
echo              AI Vision Control System
echo.
echo ============================================================
echo.
echo  Project : Industrial Camera Detection
echo  Platform: Node.js + Python AI (3.12)
echo.
echo ============================================================
echo.

REM ============================================================
REM [1/8] PROJECT PATH
REM ============================================================

echo [1/8] Checking project paths...
echo.

set "SCRIPT_DIR=%~dp0"
set "SERVER_DIR=%SCRIPT_DIR%server"
set "VENV=%SCRIPT_DIR%.venv"
set "VENV_DIR=%VENV%"
set "PYTHON_EXE=%VENV%\Scripts\python.exe"

echo Project directory:
echo %SCRIPT_DIR%
echo.

if not exist "%SERVER_DIR%" (
    color 0C
    echo ERROR: Server directory not found:
    echo %SERVER_DIR%
    echo.
    echo Make sure the project contains a "server" folder.
    echo.
    pause
    exit /b 1
)

echo OK - Server directory found.
echo.


REM ============================================================
REM [2/8] CHECK NODE.JS
REM ============================================================

echo [2/8] Checking Node.js...
echo.

where node >nul 2>&1

if errorlevel 1 (
    color 0C
    echo ERROR: Node.js is not installed or not available in PATH.
    echo.
    echo Please install Node.js and restart this script.
    echo.
    pause
    exit /b 1
)

node --version

if errorlevel 1 (
    color 0C
    echo ERROR: Node.js cannot be executed.
    echo.
    pause
    exit /b 1
)

where npm >nul 2>&1

if errorlevel 1 (
    color 0C
    echo ERROR: npm is not available.
    echo.
    pause
    exit /b 1
)

call npm --version

if errorlevel 1 (
    color 0C
    echo ERROR: npm cannot be executed.
    echo.
    pause
    exit /b 1
)

echo.
echo OK - Node.js and npm are available.
echo.


REM ============================================================
REM [3/8] DETECT PYTHON (FORCED 3.12)
REM ============================================================

echo [3/8] Checking for Python 3.12...
echo.

set "PYTHON_CMD="

REM ------------------------------------------------------------
REM 1. Try Python Launcher with 3.12 specifically
REM ------------------------------------------------------------
echo Testing Python Launcher (py -3.12)...
py -3.12 --version >nul 2>&1

if not errorlevel 1 (
    set "PYTHON_CMD=py -3.12"
    echo OK - Python 3.12 detected via Launcher.
    py -3.12 --version
    goto PYTHON_FOUND
)

REM ------------------------------------------------------------
REM 2. Try common Python 3.12 installation paths
REM ------------------------------------------------------------
echo Launcher not working. Searching Python 3.12 paths...
echo.

if exist "%LocalAppData%\Programs\Python\Python312\python.exe" (
    set "PYTHON_CMD=%LocalAppData%\Programs\Python\Python312\python.exe"
    echo OK - Found Python 3.12 in LocalAppData.
    goto PYTHON_FOUND
)

if exist "%ProgramFiles%\Python312\python.exe" (
    set "PYTHON_CMD=%ProgramFiles%\Python312\python.exe"
    echo OK - Found Python 3.12 in ProgramFiles.
    goto PYTHON_FOUND
)

REM ------------------------------------------------------------
REM 3. Fallback to default python command
REM ------------------------------------------------------------
echo Testing default python command...

python --version >nul 2>&1

if not errorlevel 1 (
    set "PYTHON_CMD=python"
    echo WARNING - Using default Python. Please ensure it is 3.12.
    python --version
    goto PYTHON_FOUND
)

REM ------------------------------------------------------------
REM Python not found
REM ------------------------------------------------------------
color 0C
echo ============================================================
echo ERROR: PYTHON 3.12 NOT FOUND
echo ============================================================
echo.
echo Please install Python 3.12.x from python.org
echo Make sure to check "Add python.exe to PATH" during installation.
echo.
pause
exit /b 1

:PYTHON_FOUND

echo.
echo Python command:
echo %PYTHON_CMD%
echo.

if "%PYTHON_CMD%"=="py -3.12" (
    py -3.12 --version
) else if "%PYTHON_CMD%"=="python" (
    python --version
) else (
    "%PYTHON_CMD%" --version
)

if errorlevel 1 (
    color 0C
    echo ERROR: Python was found but cannot be executed.
    echo.
    echo Detected command:
    echo %PYTHON_CMD%
    echo.
    pause
    exit /b 1
)

echo.
echo OK - Python is working.
echo.


REM ============================================================
REM [4/8] CREATE / CHECK VIRTUAL ENVIRONMENT
REM ============================================================

echo [4/8] Checking virtual environment...
echo.

if exist "%PYTHON_EXE%" (
    echo OK - Existing virtual environment found.
    echo.
    goto VENV_READY
)

echo Virtual environment not found.
echo Creating:
echo %VENV%
echo.

if "%PYTHON_CMD%"=="py -3.12" (
    py -3.12 -m venv "%VENV%"
) else if "%PYTHON_CMD%"=="python" (
    python -m venv "%VENV%"
) else (
    "%PYTHON_CMD%" -m venv "%VENV%"
)

if errorlevel 1 (
    color 0C
    echo.
    echo ERROR: Failed to create Python virtual environment.
    echo.
    echo Python used:
    echo %PYTHON_CMD%
    echo.
    echo Target:
    echo %VENV%
    echo.
    pause
    exit /b 1
)

if not exist "%PYTHON_EXE%" (
    color 0C
    echo ERROR: Virtual environment was created but
    echo python.exe was not found.
    echo.
    echo Expected:
    echo %PYTHON_EXE%
    echo.
    pause
    exit /b 1
)

echo.
echo OK - Virtual environment created.
echo.


:VENV_READY

echo Python environment:
echo %PYTHON_EXE%
echo.

"%PYTHON_EXE%" --version

if errorlevel 1 (
    color 0C
    echo ERROR: Virtual environment Python cannot be executed.
    echo.
    pause
    exit /b 1
)

echo.


REM ============================================================
REM [5/8] INSTALL PYTHON DEPENDENCIES
REM ============================================================

echo [5/8] Checking Python AI dependencies...
echo.

echo Upgrading pip...
"%PYTHON_EXE%" -m pip install --upgrade pip

if errorlevel 1 (
    color 0C
    echo.
    echo WARNING: pip upgrade failed.
    echo Continuing with existing pip...
    echo.
)

echo.
echo Checking PyTorch...

"%PYTHON_EXE%" -c "import torch; print('PyTorch OK - version:', torch.__version__)" >nul 2>&1

if errorlevel 1 (
    echo PyTorch not installed.
    echo Installing PyTorch...
    echo.

    "%PYTHON_EXE%" -m pip install torch torchvision

    if errorlevel 1 (
        color 0C
        echo.
        echo ERROR: PyTorch installation failed.
        echo.
        pause
        exit /b 1
    )
) else (
    echo OK - PyTorch already installed.
)

echo.
echo Checking torchvision...

"%PYTHON_EXE%" -c "import torchvision; print('Torchvision OK')" >nul 2>&1

if errorlevel 1 (
    echo Torchvision not installed.
    echo Installing torchvision...
    echo.

    "%PYTHON_EXE%" -m pip install torchvision

    if errorlevel 1 (
        color 0C
        echo.
        echo ERROR: Torchvision installation failed.
        echo.
        pause
        exit /b 1
    )
) else (
    echo OK - Torchvision already installed.
)

echo.
echo Checking Ultralytics...

"%PYTHON_EXE%" -c "import ultralytics; print('Ultralytics OK')" >nul 2>&1

if errorlevel 1 (
    echo Ultralytics not installed.
    echo Installing Ultralytics...
    echo.

    "%PYTHON_EXE%" -m pip install ultralytics

    if errorlevel 1 (
        color 0C
        echo.
        echo ERROR: Ultralytics installation failed.
        echo.
        pause
        exit /b 1
    )
) else (
    echo OK - Ultralytics already installed.
)

echo.
echo Checking Pillow...

"%PYTHON_EXE%" -c "from PIL import Image; print('Pillow OK')" >nul 2>&1

if errorlevel 1 (
    echo Pillow not installed.
    echo Installing Pillow...
    echo.

    "%PYTHON_EXE%" -m pip install pillow

    if errorlevel 1 (
        color 0C
        echo.
        echo ERROR: Pillow installation failed.
        echo.
        pause
        exit /b 1
    )
) else (
    echo OK - Pillow already installed.
)

echo.
echo ============================================================
echo Python AI dependencies ready.
echo ============================================================
echo.


REM ============================================================
REM [6/8] CHECK PROJECT FILES
REM ============================================================

echo [6/8] Checking project files...
echo.

if not exist "%SERVER_DIR%\server.js" (
    color 0C
    echo ERROR: server.js not found.
    echo.
    echo Expected:
    echo %SERVER_DIR%\server.js
    echo.
    pause
    exit /b 1
)

echo OK - server.js

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

echo OK - inference.py

if not exist "%SERVER_DIR%\best.pt" (
    color 0C
    echo ERROR: YOLO model not found.
    echo.
    echo Expected:
    echo %SERVER_DIR%\best.pt
    echo.
    pause
    exit /b 1
)

echo OK - best.pt

if not exist "%SERVER_DIR%\resnet50_classification_best.pth" (
    color 0C
    echo ERROR: ResNet50 model not found.
    echo.
    echo Expected:
    echo %SERVER_DIR%\resnet50_classification_best.pth
    echo.
    pause
    exit /b 1
)

echo OK - resnet50_classification_best.pth

echo.
echo All required project files found.
echo.


REM ============================================================
REM [7/8] TEST AI MODELS
REM ============================================================

echo [7/8] Testing AI models...
echo.

echo ------------------------------------------------------------
echo Testing PyTorch
echo ------------------------------------------------------------

"%PYTHON_EXE%" -c "import torch; print('Torch version:', torch.__version__); print('CUDA available:', torch.cuda.is_available())"

if errorlevel 1 (
    color 0C
    echo.
    echo ERROR: PyTorch test failed.
    echo.
    pause
    exit /b 1
)

echo.
echo ------------------------------------------------------------
echo Testing Ultralytics / YOLO
echo ------------------------------------------------------------

"%PYTHON_EXE%" -c "from ultralytics import YOLO; model=YOLO(r'%SERVER_DIR%\best.pt'); print('YOLO model loaded successfully'); print('Classes:', model.names)"

if errorlevel 1 (
    color 0C
    echo.
    echo ERROR: YOLO model could not be loaded.
    echo.
    echo Model:
    echo %SERVER_DIR%\best.pt
    echo.
    pause
    exit /b 1
)

echo.
echo ------------------------------------------------------------
echo Testing ResNet50
echo ------------------------------------------------------------

"%PYTHON_EXE%" -c "import torch; p=r'%SERVER_DIR%\resnet50_classification_best.pth'; c=torch.load(p,map_location='cpu'); assert isinstance(c,dict); assert 'model_state_dict' in c; assert 'classes' in c; assert 'num_classes' in c; print('ResNet50 checkpoint loaded successfully'); print('Classes:', c['classes']); print('Number of classes:', c['num_classes'])"

if errorlevel 1 (
    color 0C
    echo.
    echo ERROR: ResNet50 model could not be loaded.
    echo.
    echo Model:
    echo %SERVER_DIR%\resnet50_classification_best.pth
    echo.
    echo The checkpoint must contain:
    echo     model_state_dict
    echo     classes
    echo     num_classes
    echo.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo AI MODELS READY
echo ============================================================
echo.


REM ============================================================
REM [8/8] NODE.JS DEPENDENCIES + START SERVER
REM ============================================================

echo [8/8] Preparing Node.js server...
echo.

cd /d "%SERVER_DIR%"

if errorlevel 1 (
    color 0C
    echo ERROR: Cannot access server directory.
    echo.
    pause
    exit /b 1
)

echo Current directory:
cd
echo.

if not exist "package.json" (
    color 0C
    echo ERROR: package.json not found.
    echo.
    echo Expected:
    echo %SERVER_DIR%\package.json
    echo.
    pause
    exit /b 1
)

echo package.json found.
echo.

if not exist "node_modules" (
    echo node_modules not found.
    echo Installing Node.js dependencies...
    echo.

    call npm install

    if errorlevel 1 (
        color 0C
        echo.
        echo ERROR: npm install failed.
        echo.
        pause
        exit /b 1
    )
) else (
    echo OK - node_modules already exists.
)

echo.
echo ============================================================
echo STARTING VALEO SMART CAMERA
echo ============================================================
echo.
echo Python:
echo %PYTHON_EXE%
echo.
echo Server:
echo %SERVER_DIR%\server.js
echo.
echo YOLO:
echo %SERVER_DIR%\best.pt
echo.
echo ResNet50:
echo %SERVER_DIR%\resnet50_classification_best.pth
echo.
echo ============================================================
echo.
echo Roboflow dependency: DISABLED
echo Local AI models: ENABLED
echo.
echo ============================================================
echo.

REM ------------------------------------------------------------
REM Tell server.js to use the project virtual environment
REM ------------------------------------------------------------

set "VALEO_PYTHON=%PYTHON_EXE%"

echo VALEO_PYTHON:
echo %VALEO_PYTHON%
echo.

node server.js

echo.
echo ============================================================
echo SERVER STOPPED
echo ============================================================
echo.
echo If the server stopped because of an error,
echo read the message displayed above.
echo.
pause

endlocal