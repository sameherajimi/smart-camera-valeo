#!/usr/bin/env python3

import json
import os
import sys

import torch
import torch.nn as nn
from PIL import Image
from torchvision import models, transforms
from ultralytics import YOLO


PRIMARY_MIN_CONFIDENCE = 0.40
JIG_MIN_CONFIDENCE = 0.20


BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

RESNET_MODEL_PATH = os.path.join(
    BASE_DIR,
    "resnet50_classification_best.pth"
)

YOLO_MODEL_PATH = os.path.join(
    BASE_DIR,
    "best.pt"
)


DEVICE = torch.device(
    "cuda" if torch.cuda.is_available() else "cpu"
)


def load_resnet_model():

    if not os.path.isfile(RESNET_MODEL_PATH):
        raise RuntimeError(
            f"Modèle ResNet50 introuvable : "
            f"{RESNET_MODEL_PATH}"
        )

    checkpoint = torch.load(
        RESNET_MODEL_PATH,
        map_location=DEVICE
    )

    if "model_state_dict" in checkpoint:

        classes = checkpoint["classes"]
        num_classes = checkpoint["num_classes"]

        model = models.resnet50(
            weights=None
        )

        model.fc = nn.Linear(
            model.fc.in_features,
            num_classes
        )

        model.load_state_dict(
            checkpoint["model_state_dict"]
        )

    else:

        raise RuntimeError(
            "Format du modèle ResNet50 invalide. "
            "Le fichier doit contenir "
            "'model_state_dict', 'classes' et "
            "'num_classes'."
        )

    model = model.to(DEVICE)
    model.eval()

    return model, classes


def classify_product(
    image_path,
    model,
    classes
):

    transform = transforms.Compose([
        transforms.Resize((256, 256)),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        )
    ])

    try:

        image = Image.open(
            image_path
        ).convert("RGB")

    except Exception as e:

        raise RuntimeError(
            f"Impossible d'ouvrir l'image : {e}"
        )

    input_tensor = transform(
        image
    )

    input_tensor = input_tensor.unsqueeze(
        0
    ).to(DEVICE)

    with torch.no_grad():

        output = model(
            input_tensor
        )

        probabilities = torch.softmax(
            output,
            dim=1
        )

        confidence, predicted = torch.max(
            probabilities,
            dim=1
        )

    class_index = predicted.item()

    confidence_value = (
        confidence.item()
    )

    if class_index >= len(classes):
        raise RuntimeError(
            "Indice de classe invalide."
        )

    product = str(
        classes[class_index]
    )

    detection = {
        "product": product,
        "confidence": confidence_value,
        "x": None,
        "y": None,
        "width": None,
        "height": None,
        "model": "primary"
    }

    return detection


def detect_jigs_local(
    image_path,
    model
):

    detections = []

    results = model.predict(
        source=image_path,
        conf=JIG_MIN_CONFIDENCE,
        verbose=False
    )

    for result in results:

        if result.boxes is None:
            continue

        boxes = result.boxes

        for i in range(len(boxes)):

            confidence = float(
                boxes.conf[i].item()
            )

            if confidence < JIG_MIN_CONFIDENCE:
                continue

            class_id = int(
                boxes.cls[i].item()
            )

            if isinstance(
                model.names,
                dict
            ):

                label = model.names.get(
                    class_id,
                    str(class_id)
                )

            else:

                label = model.names[
                    class_id
                ]

            xywh = boxes.xywh[
                i
            ].tolist()

            x = float(
                xywh[0]
            )

            y = float(
                xywh[1]
            )

            width = float(
                xywh[2]
            )

            height = float(
                xywh[3]
            )

            detections.append({
                "product": str(label),
                "confidence": confidence,
                "x": x,
                "y": y,
                "width": width,
                "height": height,
                "model": "secondary"
            })

    return detections


def main(image_path):

    if not os.path.isfile(image_path):

        raise RuntimeError(
            f"Image introuvable : "
            f"{image_path}"
        )

    if not os.path.isfile(
        RESNET_MODEL_PATH
    ):

        raise RuntimeError(
            f"Modèle ResNet50 introuvable : "
            f"{RESNET_MODEL_PATH}"
        )

    if not os.path.isfile(
        YOLO_MODEL_PATH
    ):

        raise RuntimeError(
            f"Modèle YOLO introuvable : "
            f"{YOLO_MODEL_PATH}"
        )

    print(
        f"[SYSTEM] Device : {DEVICE}",
        file=sys.stderr
    )

    # ==================================
    # 1. CLASSIFICATION ResNet50
    # ==================================

    try:

        resnet_model, classes = (
            load_resnet_model()
        )

        product_detection = (
            classify_product(
                image_path,
                resnet_model,
                classes
            )
        )

        product_detections = []

        if (
            product_detection["confidence"]
            >= PRIMARY_MIN_CONFIDENCE
        ):

            product_detections.append(
                product_detection
            )

        else:

            print(
                "[CLASSIFICATION] "
                "Confiance sous le seuil.",
                file=sys.stderr
            )

    except Exception as e:

        print(
            f"Error in ResNet50 classification: {e}",
            file=sys.stderr
        )

        product_detections = []


    # ==================================
    # 2. DETECTION YOLO DES JIGS
    # ==================================

    try:

        local_model = YOLO(
            YOLO_MODEL_PATH
        )

        jig_detections = (
            detect_jigs_local(
                image_path,
                local_model
            )
        )

    except Exception as e:

        print(
            f"Error in local YOLO model: {e}",
            file=sys.stderr
        )

        jig_detections = []


    # ==================================
    # 3. COMPTAGE PRODUITS
    # ==================================

    counts = {}

    for detection in product_detections:

        product = detection[
            "product"
        ]

        counts[product] = (
            counts.get(
                product,
                0
            ) + 1
        )


    # ==================================
    # 4. COMPTAGE JIGS
    # ==================================

    jig_counts = {}

    for detection in jig_detections:

        jig = detection[
            "product"
        ]

        jig_counts[jig] = (
            jig_counts.get(
                jig,
                0
            ) + 1
        )

    jig_count = len(
        jig_detections
    )


    # ==================================
    # 5. LOGS
    # ==================================

    print(
        f"[CLASSIFICATION] "
        f"Modèle : {RESNET_MODEL_PATH}",
        file=sys.stderr
    )

    if product_detections:

        best_product = (
            product_detections[0]
        )

        print(
            f"[CLASSIFICATION] "
            f"Produit : "
            f"{best_product['product']} | "
            f"Confiance : "
            f"{best_product['confidence']:.2f}",
            file=sys.stderr
        )

    else:

        print(
            "[CLASSIFICATION] "
            "Aucune classification valide.",
            file=sys.stderr
        )

    print(
        f"[JIG] Modèle : {YOLO_MODEL_PATH}",
        file=sys.stderr
    )

    print(
        f"[JIG] Après seuil "
        f"{JIG_MIN_CONFIDENCE:.2f} : "
        f"{jig_count}",
        file=sys.stderr
    )


    # ==================================
    # 6. RESULTAT JSON
    # ==================================

    result = {
        "detections": product_detections,
        "counts": counts,
        "jig_detections": jig_detections,
        "jig_count": jig_count,
        "jig_counts": jig_counts
    }

    print(
        json.dumps(
            result,
            ensure_ascii=False
        )
    )


if __name__ == "__main__":

    if len(sys.argv) != 2:

        raise SystemExit(
            "Usage: inference.py IMAGE_PATH"
        )

    main(
        sys.argv[1]
    )