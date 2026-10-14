from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from backend.services.disposal import CATEGORY_ALIASES, load_waste_rules
from backend.services.vision import classify_image, VisionServiceError


BACKEND_DIR = Path(__file__).resolve().parents[1]
RULES_FILE = BACKEND_DIR / "data" / "waste_rules.json"

# Below this score, the result needs extra caution.
REVIEW_THRESHOLD = 0.65


class ClassificationError(Exception):
    """Raised when a classification result cannot be prepared."""


def classify_waste(image_bytes: bytes) -> dict[str, Any]:
    """Classify an image and attach matching disposal guidance."""
    try:
        prediction = classify_image(image_bytes)
    except VisionServiceError as exc:
        raise ClassificationError(str(exc)) from exc
    except Exception as exc:
        raise ClassificationError(
            f"Classification failed: {exc}"
        ) from exc

    rules = load_waste_rules()
    raw_category = str(prediction.get("category", "general_waste")).strip().lower()
    category = CATEGORY_ALIASES.get(raw_category, raw_category)

    guidance = rules.get(category)
    if not isinstance(guidance, dict):
        category = "general_waste"
        guidance = rules.get(category, {
            "display_name": "General Waste",
            "category": "Landfill / Residual Waste",
            "instructions": ["Check local disposal guidelines for this specific item."],
            "caution": "Unable to verify the exact category.",
        })

    confidence = prediction["confidence"]
    material_uncertain = prediction.get("material_uncertain", False)
    needs_review = (
        confidence < REVIEW_THRESHOLD
        or material_uncertain
        or category == "general_waste"
    )

    return {
        "success": True,
        "item_name": prediction["item_name"],
        "category": category,
        "category_label": guidance.get("display_name", category.replace("_", " ").title()),
        "confidence": confidence,
        "confidence_note": (
            "AI-reported visual confidence; local municipal regulations take precedence."
        ),
        "visual_evidence": prediction.get("visual_evidence", ""),
        "material_uncertain": material_uncertain,
        "needs_review": needs_review,
        "disposal": {
            "category": guidance.get("category", "General Disposal"),
            "instructions": guidance.get("instructions", []),
            "caution": guidance.get("caution", ""),
        },
        "model": prediction.get("model", ""),
    }
