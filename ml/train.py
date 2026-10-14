
"""
Optional EcoSort AI image-classifier training script.

Expected dataset structure:

dataset/
    train/
        plastic_bottle/
        paper_cardboard/
        glass/
        metal_can/
        organic_waste/
        electronic_waste/
        general_waste/
    validation/
        plastic_bottle/
        paper_cardboard/
        glass/
        metal_can/
        organic_waste/
        electronic_waste/
        general_waste/

Install optional dependencies:
    python -m pip install tensorflow

Run from the project root:
    python ml/train.py --data-dir dataset --output ml/waste_classifier.keras

This model is experimental. Evaluate it on independent images before use.
"""

import argparse
import json
from pathlib import Path

try:
    import tensorflow as tf
except ImportError as exc:
    raise SystemExit(
        "TensorFlow is required for this optional training script. "
        "Install it with: python -m pip install tensorflow"
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
        description="Train an experimental EcoSort AI image classifier."
    )
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=PROJECT_DIR / "dataset",
        help="Dataset root containing train/ and validation/ directories.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=PROJECT_DIR / "ml" / "waste_classifier.keras",
        help="Output path for the trained Keras model.",
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=10,
        help="Number of training epochs.",
    )
    return parser.parse_args()


def load_datasets(data_dir: Path):
    train_dir = data_dir / "train"
    validation_dir = data_dir / "validation"

    if not train_dir.is_dir() or not validation_dir.is_dir():
        raise SystemExit(
            f"Expected these directories:\n"
            f"  {train_dir}\n"
            f"  {validation_dir}"
        )

    for category in CATEGORIES:
        if not (train_dir / category).is_dir():
            raise SystemExit(
                f"Missing training category directory: {train_dir / category}"
            )
        if not (validation_dir / category).is_dir():
            raise SystemExit(
                "Missing validation category directory: "
                f"{validation_dir / category}"
            )

    train_data = tf.keras.utils.image_dataset_from_directory(
        train_dir,
        class_names=CATEGORIES,
        image_size=IMAGE_SIZE,
        batch_size=BATCH_SIZE,
        seed=SEED,
        label_mode="int",
    )

    validation_data = tf.keras.utils.image_dataset_from_directory(
        validation_dir,
        class_names=CATEGORIES,
        image_size=IMAGE_SIZE,
        batch_size=BATCH_SIZE,
        shuffle=False,
        label_mode="int",
    )

    autotune = tf.data.AUTOTUNE

    train_data = train_data.prefetch(buffer_size=autotune)
    validation_data = validation_data.prefetch(buffer_size=autotune)

    return train_data, validation_data


def build_model():
    augmentation = tf.keras.Sequential(
        [
            tf.keras.layers.RandomFlip("horizontal"),
            tf.keras.layers.RandomRotation(0.05),
            tf.keras.layers.RandomZoom(0.1),
        ],
        name="data_augmentation",
    )

    base_model = tf.keras.applications.MobileNetV2(
        input_shape=(*IMAGE_SIZE, 3),
        include_top=False,
        weights="imagenet",
    )

    base_model.trainable = False

    inputs = tf.keras.Input(shape=(*IMAGE_SIZE, 3))
    x = augmentation(inputs)
    x = tf.keras.applications.mobilenet_v2.preprocess_input(x)
    x = base_model(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.25)(x)
    outputs = tf.keras.layers.Dense(
        len(CATEGORIES),
        activation="softmax",
        name="category_probabilities",
    )(x)

    model = tf.keras.Model(inputs, outputs, name="ecosort_classifier")

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.0005),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    return model


def main():
    args = parse_args()

    if args.epochs < 1:
        raise SystemExit("--epochs must be at least 1.")

    tf.keras.utils.set_random_seed(SEED)

    train_data, validation_data = load_datasets(args.data_dir)
    model = build_model()

    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor="val_loss",
            patience=3,
            restore_best_weights=True,
        ),
    ]

    model.fit(
        train_data,
        validation_data=validation_data,
        epochs=args.epochs,
        callbacks=callbacks,
    )

    args.output.parent.mkdir(parents=True, exist_ok=True)
    model.save(args.output)

    metadata_path = args.output.with_suffix(".json")
    metadata_path.write_text(
        json.dumps(
            {
                "model": args.output.name,
                "image_size": list(IMAGE_SIZE),
                "categories": CATEGORIES,
                "experimental": True,
                "note": (
                    "Evaluate with independent test images before deployment."
                ),
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"Model saved to: {args.output}")
    print(f"Metadata saved to: {metadata_path}")


if __name__ == "__main__":
    main()
