# 🚗 VALEO - Système de Contrôle Qualité par Vision Intelligente (AI Vision Control)

[![Platform](https://img.shields.io/badge/Platform-Node.js%20%7C%20Python%203.12-blue.svg)](https://nodejs.org/)
[![AI Models](https://img.shields.io/badge/AI-PyTorch%20ResNet50%20%2B%20Ultralytics%20YOLO-green.svg)](https://pytorch.org/)
[![Camera](https://img.shields.io/badge/Camera-Cognex%20In--Sight%20TCP-orange.svg)](https://www.cognex.com/)
[![License](https://img.shields.io/badge/Valeo-Internal%20Industrial%20System-red.svg)](#)

Bienvenue sur le projet **Valeo Intelligent Camera System**, une solution industrielle complète de contrôle qualité et de traçabilité automatisée pour lignes de production. L'application combine une interface web temps réel, des modèles d'intelligence artificielle exécutés 100% en local, le pilotage direct de caméras industrielles **Cognex In-Sight**, et la génération de déclarations de production conformes aux standards **FlexNet/MES**.

---

## 📋 Table des Matières

1. [Vue d'ensemble & Architecture](#-1-vue-densemble--architecture)
2. [Arborescence du Projet](#-2-arborescence-du-projet)
3. [Prérequis Système](#-3-prérequis-système)
4. [Démarrage Rapide (1-Clic)](#-4-démarrage-rapide-1-clic)
5. [Installation & Démarrage Manuel](#-5-installation--démarrage-manuel)
6. [Authentification & Rôles](#-6-authentification--rôles)
7. [Fonctionnalités des Modules](#-7-fonctionnalités-des-modules)
8. [Intégration Matérielle & IA](#-8-intégration-matérielle--ia)
9. [Dépannage & FAQ](#-9-dépannage--faq)

---

## 🏗️ 1. Vue d'ensemble & Architecture

Le système s'articule autour de trois couches coordonnées :

```
       ┌────────────────────────────────────────────────────────┐
       │             Interface Utilisateur Web                  │
       │    Dashboard | Live Vision | Historique | Admin        │
       └───────────────────────────┬────────────────────────────┘
                                   │ HTTP / REST API (Port 3000)
       ┌───────────────────────────▼────────────────────────────┐
       │             Backend Serveur (Node.js Express)          │
       │  • Gestion sessions & RBAC      • Persistance SQLite   │
       │  • Sync Excel (comptes_valeo)   • Génération XML MES   │
       └─────────────────────┬──────────────┬───────────────────┘
                             │              │
     Process IPC / JSON      │              │ TCP Socket (Port 23)
 ┌───────────────────────────▼──┐        ┌──▼───────────────────────────┐
 │       Pipeline IA Python     │        │  Caméra Industrielle Cognex  │
 │  • ResNet50 (Classification) │        │  • Déclenchement SE8 / RB    │
 │  • YOLOv8 (Détection Jigs)   │        │  • Décodage BMP -> OpenCV    │
 └──────────────────────────────┘        └──────────────────────────────┘
```

### Caractéristiques principales :
- **IA 100% Locale (Zéro Cloud)** :
  - **Classification de produits** : Modèle PyTorch `ResNet50` (`server/resnet50_classification_best.pth`).
  - **Détection des détrompeurs / Jigs** : Modèle Ultralytics `YOLO` (`server/best.pt`).
- **Vision Industrielle Cognex In-Sight** :
  - Communication directe par socket TCP/IP (port 23) avec acquisition à haute fréquence.
  - Bascule transparente entre flux Cognex et Webcam classique.
- **Base de Données & Excel Hybride** :
  - Base SQLite locale (`valeo.db`) pour la réactivité en production.
  - Synchronisation automatique avec le tableur Excel d'usine (`server/comptes_valeo.xlsx`).
- **Traçabilité & Export MES** :
  - Génération automatique des fichiers XML standardisés `FSA_INT_FlatFileManager` vers `server/xml/`.

---

## 📁 2. Arborescence du Projet

```
smart-camera-valeo-main/
│
├── assets/                         # Ressources graphiques & logos
│   └── valeo-logo.png              # Logo officiel Valeo
│
├── docs/                           # Documentation et modèles
│   ├── TODO.md                     # Historique des fonctionnalités et correctifs
│   └── templates/
│       └── flexnet_sample.xml      # Gabarit d'intégration XML FlexNet/MES
│
├── js/                             # Logique JavaScript côté client
│   ├── api.js                      # Client d'appels API REST
│   ├── camera-status.js            # Moniteur d'état de la caméra
│   ├── index.js                    # Utilitaires globaux
│   ├── login.js                    # Logique de connexion
│   └── signup.js                   # Logique d'enregistrement
│
├── server/                         # Serveur d'application, IA et données
│   ├── best.pt                     # Poids du modèle YOLO (détection des jigs)
│   ├── resnet50_classification_best.pth # Poids du modèle ResNet50
│   ├── cognex_camera.py            # Pilote d'acquisition caméra Cognex
│   ├── inference.py                # Moteur d'inférence IA unifié (PyTorch + YOLO)
│   ├── database.js                 # Gestionnaire SQLite et sync Excel
│   ├── server.js                   # Serveur Express & routes de l'API
│   ├── smtp-server.js              # Serveur de test pour les alertes email
│   ├── comptes_valeo.xlsx          # Registre des comptes utilisateurs
│   ├── history.json                # Journal persistant des contrôles
│   ├── package.json                # Dépendances Node.js
│   ├── captures/                   # Clichés de production horodatés
│   └── xml/                        # Déclarations XML prêtes pour le MES
│
├── admin.html                      # Console d'administration des utilisateurs
├── dashboard.html                  # Tableau de bord opérationnel & KPI
├── historique.html                 # Consultation des contrôles & filtres
├── live.html                       # Flux vidéo en direct & inspection manuelle
├── loading.html                    # Écran de garde & contrôle de session
├── login.html                      # Écran d'authentification
├── settings.html                   # Paramètres utilisateur
├── signup.html                     # Création de compte opérateur
│
├── .gitignore                      # Règles d'exclusion Git
├── requirements.txt                # Dépendances Python réelles
├── README.md                       # Documentation du projet
├── start.bat                       # Lanceur automatisé Windows (1-clic)
└── start.sh                        # Lanceur automatisé Linux
```

---

## ⚙️ 3. Prérequis Système

| Composant | Version Requise | Utilité |
| :--- | :--- | :--- |
| **Node.js** | v16.0 ou supérieur (v18/v20 conseillé) | Exécution du serveur backend et de l'API |
| **Python** | v3.10 à v3.12 (v3.12 recommandé) | Inférence PyTorch/YOLO et pilote Cognex |
| **Navigateur Web** | Google Chrome, Edge, Firefox, Chromium | Interface utilisateur interactive |
| **Accès Réseau** | Port 3000 (Web), Port 23 (Cognex) | Communication interne et caméra industrielle |

> [!IMPORTANT]
> Sous Windows, assurez-vous que l'option **"Add Python to PATH"** a bien été cochée lors de l'installation de Python.

---

## 🚀 4. Démarrage Rapide (1-Clic)

Les scripts de lancement automatisés s'occupent de vérifier l'environnement, d'initialiser le `venv`, d'installer les dépendances manquantes, de tester les modèles et de démarrer l'application.

### Sous Windows :
Double-cliquez sur `start.bat` ou lancez-le depuis un terminal :
```cmd
start.bat
```
*Le script vérifie Node.js, configure l'environnement Python `.venv`, installe `torch`, `torchvision`, `ultralytics`, `opencv-python`, `numpy`, `pillow`, valide les fichiers modèles et ouvre automatiquement Google Chrome sur `http://localhost:3000`.*

### Sous Linux / macOS :
Rendez le script exécutable et lancez-le :
```bash
chmod +x start.sh
./start.sh
```

---

## 💻 5. Installation & Démarrage Manuel

Si vous préférez installer et démarrer les composants pas-à-pas :

### 1️⃣ Installation des dépendances Node.js
```bash
cd server
npm install
cd ..
```

### 2️⃣ Configuration de l'environnement virtuel Python
- **Sous Windows (PowerShell / CMD) :**
  ```cmd
  python -m venv .venv
  .venv\Scripts\python.exe -m pip install --upgrade pip
  .venv\Scripts\pip install -r requirements.txt
  ```

- **Sous Linux / macOS :**
  ```bash
  python3 -m venv .venv
  source .venv/bin/activate
  pip install --upgrade pip
  pip install -r requirements.txt
  ```

### 3️⃣ Lancement du serveur d'application
```bash
cd server
node server.js
```

Le serveur sera alors accessible à l'adresse : **[http://localhost:3000](http://localhost:3000)**.

---

## 🔐 6. Authentification & Rôles

### Compte Administrateur par défaut
Le système est initialisé avec un compte administrateur prêt à l'emploi :
- **Code de connexion :** `ADMIN-001`
- **Mot de passe :** `admin123`

### Inscription d'un nouvel utilisateur (`signup.html`)
1. Renseigner les champs obligatoires (Prénom, Nom, Email, Rôle, Mot de passe).
2. À la validation, un code matricule unique est généré (ex: `VAL-K8P2X1`).
3. **Notez ce code** : il sera requis avec le mot de passe pour chaque connexion sur `login.html`.
4. Le compte est automatiquement consigné dans la base SQLite et répercuté dans `server/comptes_valeo.xlsx`.

### Rôles applicatifs
- **Administrateur** : Accès complet (Panneau admin, création/modification/suppression d'utilisateurs, consultation des logs).
- **Ingénieur** : Accès au Dashboard, Live Vision, Historique détaillé, exports et réglages de production.
- **Technicien** : Contrôle qualité en direct, validation des pièces, consultation de l'historique de poste.
- **Ouvrier** : Vue simplifiée orientée poste de travail (Live Vision et statut de conformité immédiat).

---

## 🧭 7. Fonctionnalités des Modules

| Page | URL | Description |
| :--- | :--- | :--- |
| **Écran de chargement** | `/loading.html` | Redirection automatique selon l'état de la session |
| **Connexion** | `/login.html` | Authentification sécurisée par matricule et mot de passe haché |
| **Inscription** | `/signup.html` | Création de compte et attribution d'un matricule Valeo |
| **Dashboard** | `/dashboard.html` | Synthèse KPI : cadence, TRS, taux de conformité, graphiques horaires |
| **Live Vision** | `/live.html` | Flux vidéo en direct, détection des défauts en temps réel, sélecteur Webcam / Cognex |
| **Historique** | `/historique.html` | Recherche avancée des pièces inspectées, filtres et export des données |
| **Administration** | `/admin.html` | Gestion complète des comptes d'usine et supervision des rôles |
| **Paramètres** | `/settings.html` | Gestion du profil connecté et mise à jour du mot de passe |

---

## 🔬 8. Intégration Matérielle & IA

### Caméra Cognex In-Sight
- **Script pilote :** `server/cognex_camera.py`
- **Adresse IP d'usine :** `169.254.0.1` (configurable)
- **Port Telnet / Commande :** `23`
- **Commandes natives :**
  - `SE8` : Déclenchement de l'acquisition matérielle.
  - `RB` : Extraction du flux brut sous format bitmap hexadécimal.
- **Modes supportés en ligne de commande :**
  ```bash
  python cognex_camera.py test     # Vérifie la connectivité réseau
  python cognex_camera.py capture  # Réalise un cliché unique
  python cognex_camera.py stream   # Fournit un flux continu JSON / Base64
  ```

### Moteur d'Inférence IA (`server/inference.py`)
- **Étape 1 : Classification du produit**
  - Entrée : Cliché capturé (format standardisé 224x224).
  - Modèle : `ResNet50` fine-tuné sur les références de pièces Valeo.
  - Sortie : Référence produit détectée + indice de confiance (seuil minimal : 40%).
- **Étape 2 : Détection des Jigs / Détrompeurs**
  - Modèle : `YOLOv8` (`server/best.pt`).
  - Détection et localisation des détrompeurs pour s'assurer du bon positionnement de la pièce (seuil minimal : 20%).
- **Étape 3 : Export FlexNet / MES**
  - Enregistrement immédiat dans `server/history.json`.
  - Génération d'un fichier XML horodaté dans `server/xml/` pour la liaison GPAO/MES.

---

## ❓ 9. Dépannage & FAQ

### Le port 3000 est déjà occupé
Sous Windows, `start.bat` libère automatiquement le port 3000 si un processus antérieur est resté ouvert. Vous pouvez également exécuter :
```cmd
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Erreur lors du chargement des modèles IA (`best.pt` ou `.pth`)
- Assurez-vous que les fichiers `best.pt` et `resnet50_classification_best.pth` sont bien situés dans le dossier `server/`.
- Vérifiez la présence des packages Python :
  ```cmd
  .venv\Scripts\python.exe -c "import torch, ultralytics; print('Modèles prêts')"
  ```

### La caméra Cognex affiche « Déconnectée »
- Vérifiez la configuration IP de votre carte réseau (l'ordinateur doit être sur la même plage réseau que la caméra, ex: `169.254.0.100` avec masque `255.255.0.0`).
- Testez le ping vers la caméra : `ping 169.254.0.1`.
- Vous pouvez basculer à tout moment sur le mode **Webcam** depuis l'interface `live.html` pour continuer les inspections en local.

---

*Projet réalisé pour Valeo — AI Industrial Vision & Quality Control System.*

