
"""
Evaluate an experimental EcoSort AI Keras image classifier.

Expected test dataset:

dataset/
    test/
        plastic_bottle/
        paper_cardboard/
        glass/
        metal_can/
        organic_waste/
        electronic_waste/
        general_waste/

Usage from the project root:
    python ml/evaluate.py --data-dir dataset/test \
        --model ml/waste_classifier.keras

Optional dependency:
    python -m pip install tensorflow scikit-learn
"""

import argparse
import json
from pathlib import Path

try:
    import tensorflow as tf
except ImportError as exc:
    raise SystemExit(
        "TensorFlow is required. Install it with: "
        "python -m pip install tensorflow"
    ) from exc

try:
    from sklearn.metrics import (
        accuracy_score,
        classification_report,
        confusion_matrix,
    )
except ImportError as exc:
    raise SystemExit(
        "scikit-learn is required. Install it with: "
        "python -m pip install scikit-learn"
    ) from exc


PROJECT_DIR = Path(__file__).resolve().parents[1]

CATEGORIES = [
    "plastic_bottle",
    "paper_cardboard",
    "glass",
    "metal_can",
    "organic_waste",
    "electronic_waste",
    "general_waste",
]

IMAGE_SIZE = (224, 224)
BATCH_SIZE = 32
SEED = 42


def parse_args():
    parser = argparse.ArgumentParser(
        description="Evaluate an EcoSort AI image classifier."
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=PROJECT_DIR / "dataset" / "test",
        help="Test directory with one subfolder per category.",
    )
    parser.add_argument(
        "--model",
        type=Path,
        default=PROJECT_DIR / "ml" / "waste_classifier.keras",
        help="Path to the trained Keras model.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=PROJECT_DIR / "ml" / "evaluation.json",
        help="Where to save evaluation results.",
    )
    return parser.parse_args()


def main():
    args = parse_args()

    if not args.model.is_file():
        raise SystemExit(f"Model not found: {args.model}")

    if not args.data_dir.is_dir():
        raise SystemExit(f"Test dataset not found: {args.data_dir}")

    for category in CATEGORIES:
        if not (args.data_dir / category).is_dir():
            raise SystemExit(
                f"Missing test category directory: "
                f"{args.data_dir / category}"
            )

    dataset = tf.keras.utils.image_dataset_from_directory(
        args.data_dir,
        class_names=CATEGORIES,
        image_size=IMAGE_SIZE,
        batch_size=BATCH_SIZE,
        shuffle=False,
        label_mode="int",
    )

    model = tf.keras.models.load_model(args.model)

    true_labels = []
    for _, labels in dataset:
        true_labels.extend(labels.numpy().tolist())

    probabilities = model.predict(dataset, verbose=0)
    predicted_labels = probabilities.argmax(axis=1).tolist()

    accuracy = accuracy_score(true_labels, predicted_labels)

    report = classification_report(
        true_labels,
        predicted_labels,
        labels=list(range(len(CATEGORIES))),
        target_names=CATEGORIES,
        output_dict=True,
        zero_division=0,
    )

    matrix = confusion_matrix(
        true_labels,
        predicted_labels,
        labels=list(range(len(CATEGORIES))),
    ).tolist()

    results = {
        "model": str(args.model),
        "test_dataset": str(args.data_dir),
        "test_image_count": len(true_labels),
        "accuracy": float(accuracy),
        "categories": CATEGORIES,
        "classification_report": report,
        "confusion_matrix": matrix,
        "warning": (
            "Test results depend on dataset quality and representativeness. "
            "They do not guarantee reliable predictions for real-world images."
        ),
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(results, indent=2),
        encoding="utf-8",
    )

    print(f"Test images: {len(true_labels)}")
    print(f"Accuracy: {accuracy:.4f}")
    print("\nPer-category results:")

    print(
        classification_report(
            true_labels,
            predicted_labels,
            labels=list(range(len(CATEGORIES))),
            target_names=CATEGORIES,
            zero_division=0,
        )
    )

    print(f"Detailed results saved to: {args.output}")


if __name__ == "__main__":
    main()
