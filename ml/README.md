# EcoSort AI — Machine Learning

This folder contains an optional image-classification training and evaluation workflow.

**Important:** The current EcoSort AI website uses the Gemini API for live image classification. The experimental model in this folder is separate and is not automatically used by the backend.

## Files

- `train.py` — trains an experimental image classifier using TensorFlow/Keras.
- `evaluate.py` — evaluates a trained model against a separate test dataset.
- `waste_classifier.keras` — generated model file; created only after training.
- `evaluation.json` — generated evaluation report.

## Supported categories

The dataset must use these exact directory names:

1. `plastic_bottle`
2. `paper_cardboard`
3. `glass`
4. `metal_can`
5. `organic_waste`
6. `electronic_waste`
7. `general_waste`

## Dataset structure

Create a dataset with separate training, validation, and test images.

```text
dataset/
├── train/
│   ├── plastic_bottle/
│   ├── paper_cardboard/
│   ├── glass/
│   ├── metal_can/
│   ├── organic_waste/
│   ├── electronic_waste/
│   └── general_waste/
├── validation/
│   └── [same seven category folders]
└── test/
    └── [same seven category folders]
```

Replace each bracketed placeholder with the seven actual category folders. Put correctly labeled image files inside each folder.

Keep the test images separate from the training and validation images. Avoid duplicate or near-duplicate images across splits.

## Optional installation

Run these commands from the project root in PowerShell:

```powershell
python -m pip install tensorflow scikit-learn
```

These dependencies are only needed for the optional training and evaluation workflow. They are not required by the current Gemini-powered website.

## Train the model

From the project root:

```powershell
python ml/train.py --data-dir dataset --output ml/waste_classifier.keras
```

The script trains a MobileNetV2-based classifier and saves the model and metadata under `ml/`.

## Evaluate the model

After training, run:

```powershell
python ml/evaluate.py --data-dir dataset/test --model ml/waste_classifier.keras
```

The evaluation script reports overall accuracy, per-category precision and recall, F1 scores, and a confusion matrix. It saves a detailed JSON report.

## Responsible use

- Use images with reliable labels and sufficient variation.
- Check for class imbalance and poor-quality images.
- Inspect errors for each category instead of relying on accuracy alone.
- Evaluate on independent, representative test images.
- Do not interpret model confidence as a calibrated probability.
- Do not use image predictions as the sole basis for hazardous-waste handling.
- Verify disposal recommendations against local rules.

The experimental model must not be connected to the live API without additional validation, integration work, and testing.