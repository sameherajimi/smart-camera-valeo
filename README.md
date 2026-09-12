# 🚗 VALEO - Intelligent Camera System (AI Vision Control)

Welcome to the **Valeo Intelligent Camera System**, a industrial vision control application designed for real-time quality control, automated product classification, jig detection, and Cognex camera integration.

The application combines a modern Web UI frontend with a **Node.js/Express** backend server and **Python AI models** (ResNet50 & YOLOv8) along with direct TCP streaming for Cognex In-Sight cameras.

---

## 📁 Repository Structure

```text
smart-camera-valeo/
├── assets/
│   └── images/
│       ├── valeo-logo.png       # Valeo official branding logo
│       └── xx.png               # Project image asset
├── js/
│   ├── api.js                   # Client-side REST API wrapper
│   ├── camera-status.js         # Camera connection monitoring script
│   ├── index.js                 # General web application logic
│   ├── login.js                 # Authentication logic
│   └── signup.js                # Account registration logic
├── server/
│   ├── best.pt                  # Local YOLOv8 weights (gitignored binary)
│   ├── cognex_camera.py         # Cognex In-Sight TCP socket & frame stream
│   ├── comptes_valeo.xlsx       # User account backup database (gitignored)
│   ├── database.js              # SQLite database interface & Excel sync
│   ├── history.json             # Inspection logs runtime database (gitignored)
│   ├── inference.py             # ResNet50 + YOLO dual-model inference engine
│   ├── package.json             # Node.js server dependencies
│   ├── resnet50_classification_best.pth # ResNet50 classification model (gitignored binary)
│   ├── server.js                # Main Express HTTP server & WebSocket/REST API
│   └── smtp-server.js           # Email notification service
├── .env.example                 # Environment configuration template
├── .gitignore                   # Workspace git ignore rules
├── admin.html                   # Administrator user management portal
├── dashboard.html               # Industrial control dashboard & metrics
├── historique.html              # Inspection logs & filtering history
├── live.html                    # Real-time camera feed & AI detection view
├── loading.html                 # Application splash screen
├── login.html                   # Secure user login interface
├── settings.html                # User profile & credentials settings
├── signup.html                  # User account registration interface
├── requirements.txt             # Python AI & Computer Vision dependencies
├── start.bat                    # Windows 1-click launcher script
├── start.sh                     # Linux / macOS 1-click launcher script
└── TODO.md                      # Feature tracking & changelog
```

---

## 🛠️ 1. Prerequisites

Before installing, ensure your machine has the following dependencies:

| Software | Required Version | Notes / Download Link |
| :--- | :--- | :--- |
| **Node.js** | `v16.0` or higher | Includes `npm`. [Download Node.js](https://nodejs.org/) |
| **Python** | `v3.8` to `v3.12` | Must check **"Add Python to PATH"** during installation. [Download Python](https://www.python.org/) |
| **Web Browser** | Any modern browser | Google Chrome, Microsoft Edge, Mozilla Firefox, Brave |

---

## 🚀 2. Quick Start & Installation

You can launch the system using either the **Automated Script** or **Manual Command Line**.

### Option A: Automated Launch Script (Recommended)

#### On Windows:
1. Open **Command Prompt** (cmd) or **PowerShell**.
2. Navigate to the project root directory:
   ```cmd
   cd C:\Users\Lenovo\Desktop\smart-camera-valeo
   ```
3. Run the 1-click startup batch script:
   ```cmd
   start.bat
   ```
   *The script automatically validates Node.js, sets up the Python virtual environment (`.venv`), installs all Node and Python dependencies, verifies local PyTorch/YOLO model files, and launches the server at `http://localhost:3000` with browser auto-open.*

#### On Linux / macOS:
1. Open terminal and navigate to the project root directory:
   ```bash
   cd smart-camera-valeo
   ```
2. Grant execution permission and launch:
   ```bash
   chmod +x start.sh
   ./start.sh
   ```

---

### Option B: Manual Terminal Setup

If you prefer installing components manually:

#### 1) Node.js Backend Dependencies
Navigate to the `server` directory and install packages:
```bash
cd server
npm install
```

#### 2) Python Environment & AI Dependencies
From the project root directory, create a Python virtual environment and install all packages:

**Windows (PowerShell / Command Prompt):**
```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

**Linux / macOS:**
```bash
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

> **Note on PyTorch GPU Acceleration:**
> If GPU (CUDA) acceleration is supported on your hardware, install the appropriate CUDA PyTorch build before running `pip install -r requirements.txt`. Refer to [PyTorch Getting Started](https://pytorch.org/get-started/locally/).

#### 3) Start Server
Start the HTTP server from the `server` directory:
```bash
node server.js
```

---

## ⚙️ 3. Environment Configuration

Copy `.env.example` to `.env` in the root folder to customize settings:

```env
# Server Port & Binding
PORT=3000

# Administrative Credentials
ADMIN_LOGIN=ADMIN-001
ADMIN_PASSWORD=your_secure_admin_password

# Python Executable Path (Optional override)
VALEO_PYTHON=../.venv/Scripts/python.exe

# Cognex In-Sight Camera Configuration
COGNEX_IP=169.254.0.1
COGNEX_PORT=23
COGNEX_USER=admin
COGNEX_PASSWORD=
```

---

## 🔑 4. User Authentication & Dashboard Access

1. Open your browser and navigate to **`http://localhost:3000`** (redirects to `login.html`).
2. **First Time Setup / Sign Up:**
   - Click **"S'inscrire"** (`http://localhost:3000/signup.html`).
   - Fill in your details (First Name, Last Name, Email, Role: *Ingénieur*, *Technicien*, or *Ouvrier*, Password).
   - Upon registration, a unique **Login Code** (e.g., `VAL-X7K9P2`) will be generated.
3. **Login:**
   - Enter your generated Login Code and Password on `login.html`.
   - Access the main Industrial Control Dashboard at `/dashboard.html`.

---

## 🧭 5. Web Interface Routes

| Route / Page | Path | Function |
| :--- | :--- | :--- |
| 📊 **Dashboard** | `/dashboard.html` | Real-time system status, production analytics, and control shortcuts |
| 📹 **Live Vision** | `/live.html` | Live camera stream feed with real-time AI bounding boxes and classification |
| 📜 **Historique** | `/historique.html` | Historical inspection records, search filters, and log exports |
| ⚙️ **Settings** | `/settings.html` | Account profile updates, password changes, and system preferences |
| 👑 **Admin Panel** | `/admin.html` | Admin portal for user account management, role modification, and audit |

---

## ❓ 6. Troubleshooting & FAQs

- **Port 3000 is already in use:**  
  The `start.bat` script automatically identifies and releases port 3000 if occupied. Alternatively, kill active Node processes or change `PORT` in your `.env` file.
- **Python / Inference Error:**  
  Verify that your `.venv` environment is activated and that PyTorch, torchvision, ultralytics, and OpenCV are installed (`pip install -r requirements.txt`).
- **Cognex Camera Connection Failed:**  
  Verify network connectivity to `169.254.0.1:23` and ensure the camera is powered on and configured for Telnet/TCP command mode (`SE8`, `RB`).

---

*Valeo Industrial AI Camera System — Quality Control & Vision Intelligence.*
