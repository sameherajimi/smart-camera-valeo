#!/usr/bin/env python3

import socket
import binascii
import cv2
import numpy as np
import base64
import json
import sys


# ==========================================
# CONFIGURATION COGNEX
# ==========================================

IP = "169.254.0.1"
PORT = 23

USER = "admin"
PASSWORD = ""


# ==========================================
# RECEPTION DES DONNEES
# ==========================================

def recv_data(sock, timeout=2):

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

    return bytes(data)


# ==========================================
# CONNEXION COGNEX
# ==========================================

def connect_camera():

    sock = socket.socket(
        socket.AF_INET,
        socket.SOCK_STREAM
    )

    sock.settimeout(5)

    sock.connect(
        (IP, PORT)
    )

    response = recv_data(sock)

    sock.sendall(
        (USER + "\r\n").encode()
    )

    recv_data(sock)

    sock.sendall(
        (PASSWORD + "\r\n").encode()
    )

    response = recv_data(sock)

    if b"User Logged In" not in response:

        raise RuntimeError(
            "Connexion à la caméra Cognex échouée"
        )

    return sock


# ==========================================
# CAPTURE IMAGE
# ==========================================

def acquire_image(sock):

    sock.sendall(
        b"SE8\r\n"
    )

    response = recv_data(sock)

    if not response:

        raise RuntimeError(
            "Aucune réponse après SE8"
        )

    sock.sendall(
        b"RB\r\n"
    )

    response = recv_data(
        sock,
        timeout=5
    )

    if not response:

        raise RuntimeError(
            "Aucune réponse après RB"
        )

    return response


# ==========================================
# EXTRACTION BMP
# ==========================================

def extract_bmp(response):

    lines = response.splitlines()

    if len(lines) < 4:

        raise RuntimeError(
            "Réponse RB invalide"
        )

    status = (
        lines[0]
        .decode(errors="replace")
        .strip()
    )

    if status != "1":

        raise RuntimeError(
            f"RB refusé : {status}"
        )

    try:

        image_size = int(
            lines[1]
            .decode(errors="replace")
            .strip()
        )

    except ValueError:

        raise RuntimeError(
            "Taille d'image invalide"
        )

    if image_size <= 0:

        raise RuntimeError(
            "La caméra n'a fourni aucune image"
        )

    hex_data = b"".join(
        lines[2:-1]
    )

    if not hex_data:

        raise RuntimeError(
            "Aucune donnée HEX reçue"
        )

    try:

        bmp_data = binascii.unhexlify(
            hex_data
        )

    except Exception as e:

        raise RuntimeError(
            f"Conversion HEX -> BMP impossible : {e}"
        )

    if not bmp_data.startswith(b"BM"):

        raise RuntimeError(
            "Les données reçues ne sont pas un BMP"
        )

    return bmp_data


# ==========================================
# BMP -> OPENCV
# ==========================================

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
            "OpenCV ne peut pas décoder l'image"
        )

    return image


# ==========================================
# IMAGE -> BASE64
# ==========================================

def image_to_base64(image):

    success, encoded = cv2.imencode(
        ".jpg",
        image,
        [
            cv2.IMWRITE_JPEG_QUALITY,
            95
        ]
    )

    if not success:

        raise RuntimeError(
            "Impossible d'encoder l'image JPEG"
        )

    image_base64 = base64.b64encode(
        encoded.tobytes()
    ).decode("utf-8")

    return (
        "data:image/jpeg;base64,"
        + image_base64
    )


# ==========================================
# CAPTURE COMPLETE
# ==========================================

def capture():

    sock = None

    try:

        print(
            "[COGNEX] Connexion...",
            file=sys.stderr
        )

        sock = connect_camera()

        print(
            "[COGNEX] Capture...",
            file=sys.stderr
        )

        response = acquire_image(
            sock
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

        print(
            f"[COGNEX] Image : {width}x{height}",
            file=sys.stderr
        )

        return {
            "success": True,
            "image": image_base64,
            "width": width,
            "height": height
        }

    finally:

        if sock is not None:

            try:
                sock.close()
            except Exception:
                pass


# ==========================================
# MAIN
# ==========================================

if __name__ == "__main__":

    try:

        result = capture()

        print(
            json.dumps(
                result,
                ensure_ascii=False
            )
        )

    except Exception as e:

        print(
            json.dumps({
                "success": False,
                "error": str(e)
            }),
            file=sys.stdout
        )

        sys.exit(1)