#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import socket
import binascii
import cv2
import numpy as np
import base64
import json
import sys
import time
import threading


# ============================================================
# CONFIGURATION COGNEX IN-SIGHT
# ============================================================

IP = "169.254.0.1"
PORT = 23

USER = "admin"
PASSWORD = ""

# Interval minimal entre deux acquisitions
# 0 = acquisition aussi rapide que possible
FRAME_INTERVAL = 0.03

# Qualité JPEG envoyée au serveur
JPEG_QUALITY = 85

# Timeout réseau
CONNECT_TIMEOUT = 5
RECEIVE_TIMEOUT = 5


# ============================================================
# RECEPTION TCP
# ============================================================

def recv_data(sock, timeout=RECEIVE_TIMEOUT):
    sock.settimeout(timeout)

    data = bytearray()

    while True:
        try:
            chunk = sock.recv(65536)

            if not chunk:
                break

            data.extend(chunk)

        except socket.timeout:
            break

        except ConnectionResetError:
            break

    return bytes(data)


# ============================================================
# CONNEXION COGNEX
# ============================================================

def connect_camera():
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    sock.setsockopt(socket.SOL_SOCKET, socket.SO_KEEPALIVE, 1)

    sock.settimeout(CONNECT_TIMEOUT)

    sock.connect((IP, PORT))

    # Message initial éventuel
    recv_data(sock, timeout=2)

    # Login
    sock.sendall((USER + "\r\n").encode("ascii"))

    recv_data(sock, timeout=2)

    # Password
    sock.sendall((PASSWORD + "\r\n").encode("ascii"))

    response = recv_data(sock, timeout=2)

    response_text = response.decode("latin1", errors="ignore")

    if (
        b"User Logged In" not in response
        and "logged in" not in response_text.lower()
        and "password" in response_text.lower()
    ):
        raise RuntimeError(
            "Connexion Cognex refusée : authentification échouée"
        )

    return sock


# ============================================================
# ACQUISITION IMAGE
# ============================================================

def acquire_image(sock):
    # Déclenchement/acquisition
    sock.sendall(b"SE8\r\n")

    response = recv_data(sock, timeout=RECEIVE_TIMEOUT)

    if not response:
        raise RuntimeError(
            "Aucune réponse de la caméra après SE8"
        )

    # Lecture de l'image
    sock.sendall(b"RB\r\n")

    response = recv_data(sock, timeout=RECEIVE_TIMEOUT)

    if not response:
        raise RuntimeError(
            "Aucune réponse de la caméra après RB"
        )

    return response


# ============================================================
# EXTRACTION BMP
# ============================================================

def extract_bmp(response):
    lines = response.splitlines()

    if len(lines) < 3:
        raise RuntimeError(
            "Réponse RB invalide"
        )

    # Premier champ = statut
    status = lines[0].decode(
        "latin1",
        errors="replace"
    ).strip()

    if status != "1":
        raise RuntimeError(
            f"RB refusé par Cognex : {status}"
        )

    # Deuxième champ = taille image
    try:
        image_size = int(
            lines[1].decode(
                "latin1",
                errors="replace"
            ).strip()
        )

    except ValueError:
        raise RuntimeError(
            "Taille d'image Cognex invalide"
        )

    if image_size <= 0:
        raise RuntimeError(
            "La caméra Cognex n'a fourni aucune image"
        )

    # Données HEX
    hex_data = b"".join(lines[2:])

    # Retirer éventuellement le dernier caractère de terminaison
    hex_data = hex_data.strip()

    if not hex_data:
        raise RuntimeError(
            "Aucune donnée image reçue"
        )

    # Une donnée HEX doit avoir un nombre pair de caractères
    if len(hex_data) % 2 != 0:
        hex_data = hex_data[:-1]

    try:
        bmp_data = binascii.unhexlify(hex_data)

    except (binascii.Error, ValueError) as exc:
        raise RuntimeError(
            f"Conversion HEX -> BMP impossible : {exc}"
        )

    if not bmp_data.startswith(b"BM"):
        raise RuntimeError(
            "Les données reçues ne sont pas un fichier BMP valide"
        )

    return bmp_data


# ============================================================
# BMP -> OPENCV
# ============================================================

def bmp_to_opencv(bmp_data):
    buffer = np.frombuffer(
        bmp_data,
        dtype=np.uint8
    )

    image = cv2.imdecode(
        buffer,
        cv2.IMREAD_COLOR
    )

    if image is None:
        raise RuntimeError(
            "OpenCV ne peut pas décoder l'image Cognex"
        )

    return image


# ============================================================
# IMAGE -> JPEG BASE64
# ============================================================

def image_to_base64(image):
    success, encoded = cv2.imencode(
        ".jpg",
        image,
        [
            cv2.IMWRITE_JPEG_QUALITY,
            JPEG_QUALITY
        ]
    )

    if not success:
        raise RuntimeError(
            "Impossible d'encoder l'image JPEG"
        )

    return (
        "data:image/jpeg;base64,"
        + base64.b64encode(
            encoded.tobytes()
        ).decode("ascii")
    )


# ============================================================
# CAPTURE UNIQUE
# ============================================================

def capture():
    sock = None

    try:
        print(
            "[COGNEX] Connexion...",
            file=sys.stderr
        )

        sock = connect_camera()

        print(
            "[COGNEX] Acquisition...",
            file=sys.stderr
        )

        response = acquire_image(sock)

        bmp_data = extract_bmp(response)

        image = bmp_to_opencv(bmp_data)

        height, width = image.shape[:2]

        image_base64 = image_to_base64(image)

        print(
            f"[COGNEX] Image : {width}x{height}",
            file=sys.stderr
        )

        return {
            "success": True,
            "image": image_base64,
            "width": width,
            "height": height,
            "camera": "Cognex In-Sight"
        }

    finally:
        if sock is not None:
            try:
                sock.close()
            except Exception:
                pass


# ============================================================
# STREAM CONTINU
# ============================================================

class CognexStream:

    def __init__(self):
        self.running = False
        self.sock = None

        self.frame = None
        self.frame_base64 = None

        self.width = 0
        self.height = 0

        self.fps = 0.0

        self.lock = threading.Lock()

        self.thread = None

    # --------------------------------------------------------
    # DEMARRAGE
    # --------------------------------------------------------

    def start(self):

        if self.running:
            return

        self.running = True

        self.thread = threading.Thread(
            target=self._loop,
            daemon=True
        )

        self.thread.start()

    # --------------------------------------------------------
    # ARRET
    # --------------------------------------------------------

    def stop(self):

        self.running = False

        if self.sock is not None:

            try:
                self.sock.shutdown(
                    socket.SHUT_RDWR
                )

            except Exception:
                pass

            try:
                self.sock.close()

            except Exception:
                pass

            self.sock = None

        if self.thread is not None:

            try:
                self.thread.join(
                    timeout=2
                )

            except Exception:
                pass

            self.thread = None

    # --------------------------------------------------------
    # BOUCLE STREAM
    # --------------------------------------------------------

    def _loop(self):

        consecutive_errors = 0

        while self.running:

            try:

                # ------------------------------------------------
                # Connexion
                # ------------------------------------------------

                if self.sock is None:

                    print(
                        "[COGNEX] Connexion caméra...",
                        file=sys.stderr
                    )

                    self.sock = connect_camera()

                    print(
                        "[COGNEX] Caméra connectée",
                        file=sys.stderr
                    )

                # ------------------------------------------------
                # Acquisition
                # ------------------------------------------------

                start_time = time.perf_counter()

                response = acquire_image(
                    self.sock
                )

                bmp_data = extract_bmp(
                    response
                )

                image = bmp_to_opencv(
                    bmp_data
                )

                height, width = image.shape[:2]

                image_base64 = image_to_base64(
                    image
                )

                elapsed = (
                    time.perf_counter()
                    - start_time
                )

                if elapsed > 0:
                    current_fps = 1.0 / elapsed
                else:
                    current_fps = 0.0

                # ------------------------------------------------
                # Mise à jour frame
                # ------------------------------------------------

                with self.lock:

                    self.frame = image

                    self.frame_base64 = image_base64

                    self.width = width
                    self.height = height

                    self.fps = current_fps

                consecutive_errors = 0

                # ------------------------------------------------
                # Petite temporisation
                # ------------------------------------------------

                if FRAME_INTERVAL > 0:

                    time.sleep(
                        FRAME_INTERVAL
                    )

            except Exception as exc:

                consecutive_errors += 1

                print(
                    f"[COGNEX] Erreur stream : {exc}",
                    file=sys.stderr
                )

                # Fermer la connexion actuelle
                if self.sock is not None:

                    try:
                        self.sock.close()

                    except Exception:
                        pass

                    self.sock = None

                # Attendre avant reconnexion
                if self.running:

                    if consecutive_errors < 3:
                        time.sleep(0.2)
                    else:
                        time.sleep(1)

    # --------------------------------------------------------
    # FRAME COURANTE
    # --------------------------------------------------------

    def get_frame(self):

        with self.lock:

            return {
                "success": self.frame_base64 is not None,
                "image": self.frame_base64,
                "width": self.width,
                "height": self.height,
                "fps": round(
                    self.fps,
                    2
                ),
                "camera": "Cognex In-Sight"
            }


# ============================================================
# INSTANCE GLOBALE
# ============================================================

stream = CognexStream()


# ============================================================
# MODE STREAM JSON
# ============================================================

def stream_json():

    stream.start()

    print(
        "[COGNEX] Stream démarré",
        file=sys.stderr
    )

    try:

        while True:

            if not stream.running:
                break

            frame = stream.get_frame()

            # Tant qu'aucune image n'est disponible
            if not frame["success"]:

                time.sleep(0.01)

                continue

            # Envoi d'une frame JSON
            print(
                json.dumps(
                    frame,
                    ensure_ascii=False
                ),
                flush=True
            )

            # Attente très courte pour éviter
            # de saturer stdout
            time.sleep(0.01)

    except KeyboardInterrupt:

        pass

    finally:

        stream.stop()

        print(
            "[COGNEX] Stream arrêté",
            file=sys.stderr
        )


# ============================================================
# MAIN
# ============================================================

def main():

    mode = (
        sys.argv[1].lower()
        if len(sys.argv) > 1
        else "capture"
    )

    # --------------------------------------------------------
    # CAPTURE UNIQUE
    # --------------------------------------------------------

    if mode == "capture":

        try:

            result = capture()

            print(
                json.dumps(
                    result,
                    ensure_ascii=False
                )
            )

            return 0

        except Exception as exc:

            print(
                json.dumps(
                    {
                        "success": False,
                        "error": str(exc)
                    },
                    ensure_ascii=False
                )
            )

            return 1

    # --------------------------------------------------------
    # STREAM CONTINU
    # --------------------------------------------------------

    if mode == "stream":

        stream_json()

        return 0

    # --------------------------------------------------------
    # TEST CONNEXION
    # --------------------------------------------------------

    if mode == "test":

        sock = None

        try:

            print(
                "[COGNEX] Test connexion...",
                file=sys.stderr
            )

            sock = connect_camera()

            print(
                json.dumps(
                    {
                        "success": True,
                        "camera": "Cognex In-Sight",
                        "ip": IP,
                        "port": PORT,
                        "message": "Caméra connectée"
                    },
                    ensure_ascii=False
                )
            )

            return 0

        except Exception as exc:

            print(
                json.dumps(
                    {
                        "success": False,
                        "camera": "Cognex In-Sight",
                        "error": str(exc)
                    },
                    ensure_ascii=False
                )
            )

            return 1

        finally:

            if sock is not None:

                try:
                    sock.close()

                except Exception:
                    pass

    # --------------------------------------------------------
    # MODE INCONNU
    # --------------------------------------------------------

    print(
        json.dumps(
            {
                "success": False,
                "error": (
                    "Mode invalide. "
                    "Utiliser : capture, stream ou test"
                )
            },
            ensure_ascii=False
        )
    )

    return 1


# ============================================================
# EXECUTION
# ============================================================

if __name__ == "__main__":

    sys.exit(
        main()
    )