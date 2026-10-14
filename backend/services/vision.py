from __future__ import annotations

import io
import json
import os
from typing import Any

from google import genai
from google.genai import types
from PIL import Image, UnidentifiedImageError

from backend.services.ai_settings import get_api_key, get_model


MAX_IMAGE_BYTES = 10 * 1024 * 1024
ALLOWED_IMAGE_FORMATS = {"JPEG", "PNG", "WEBP"}

WASTE_CATEGORIES = {
    "plastic",
    "plastic_bottle",
    "paper",
    "cardboard",
    "paper_cardboard",
    "glass",
    "metal",
    "metal_can",
    "organic",
    "organic_waste",
    "ewaste",
    "electronic_waste",
    "textile",
    "hazardous",
    "other",
    "general_waste",
}


class VisionServiceError(Exception):
    """Raised when image classification cannot be completed."""


def _load_image(image_bytes: bytes) -> Image.Image:
    if not image_bytes:
        raise VisionServiceError("The uploaded image is empty.")

    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise VisionServiceError("Image must be 10 MB or smaller.")

    try:
        image = Image.open(io.BytesIO(image_bytes))
        image_format = (image.format or "").upper()

        if image_format not in ALLOWED_IMAGE_FORMATS:
            raise VisionServiceError(
                "Unsupported image format. Upload a JPG, PNG, or WEBP image."
            )

        image.load()
        return image.convert("RGB")

    except VisionServiceError:
        raise
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise VisionServiceError(
            "The uploaded file is not a valid image."
        ) from exc


def _extract_json(text: str) -> dict[str, Any]:
    text = (text or "").strip()

    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()

    try:
        result = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start < 0 or end <= start:
            raise VisionServiceError(
                "The AI returned an unreadable classification result."
            )
        try:
            result = json.loads(text[start : end + 1])
        except json.JSONDecodeError as exc:
            raise VisionServiceError(
                "The AI returned an unreadable classification result."
            ) from exc

    if not isinstance(result, dict):
        raise VisionServiceError("The AI returned an invalid result.")

    return result


def classify_image(image_bytes: bytes) -> dict[str, Any]:
    """Classify a waste image using the currently configured AI model."""

    api_key = get_api_key()
    model_name = get_model()

    if not api_key:
        raise VisionServiceError(
            "Gemini API key is not configured. Open AI Settings and add your API key."
        )

    image = _load_image(image_bytes)

    prompt = """
You are EcoSort AI, an expert waste-sorting vision system. Inspect the supplied image and identify
the main visible item to be sorted or disposed of.

Return ONLY a valid JSON object with these exact keys:
{
  "item_name": "short name of the visible item (e.g. Plastic Soda Bottle, Banana Peel, Cardboard Box)",
  "category": "one allowed category from the list below",
  "confidence": 0.95,
  "visual_evidence": "brief visible evidence supporting the classification (colors, labels, texture)",
  "material_uncertain": false
}

Allowed category values:
plastic_bottle, paper_cardboard, glass, metal_can, organic_waste, electronic_waste, textile, hazardous, general_waste

Rules:
- confidence must be a float from 0.0 to 1.0.
- Use only visible evidence from the image.
- If multiple items are present, focus on the primary waste item.
- If the item is ambiguous or contaminated, choose the most fitting category, set material_uncertain to true, and adjust confidence.
- Return ONLY the JSON object, no explanation outside JSON.
"""

    try:
        client = genai.Client(api_key=api_key)

        response = client.models.generate_content(
            model=model_name,
            contents=[prompt, image],
            config=types.GenerateContentConfig(
                temperature=0.1,
                response_mime_type="application/json",
            ),
        )

        result = _extract_json(response.text or "")

    except VisionServiceError:
        raise
    except Exception as exc:
        message = str(exc)
        lowered = message.lower()

        if any(term in lowered for term in ("api key", "unauthorized", "401", "403")):
            raise VisionServiceError(
                "Gemini authentication failed. Check the API key in AI Settings."
            ) from exc

        if any(term in lowered for term in ("quota", "429", "rate limit")):
            raise VisionServiceError(
                "Gemini API quota or rate limit reached. Try again later."
            ) from exc

        if any(term in lowered for term in ("not found", "404", "unsupported model")):
            raise VisionServiceError(
                f"The configured Gemini model '{model_name}' is unavailable. "
                "Choose another model in AI Settings."
            ) from exc

        raise VisionServiceError(
            f"Image classification failed: {message}"
        ) from exc

    raw_category = str(result.get("category", "general_waste")).strip().lower()

    try:
        confidence = float(result.get("confidence", 0.0))
    except (TypeError, ValueError):
        confidence = 0.0

    confidence = max(0.0, min(1.0, confidence))

    item_name = str(result.get("item_name", "Unknown item")).strip()
    visual_evidence = str(result.get("visual_evidence", "")).strip()
    material_uncertain = bool(result.get("material_uncertain", False))

    return {
        "item_name": item_name or "Unknown item",
        "category": raw_category,
        "confidence": confidence,
        "visual_evidence": visual_evidence,
        "material_uncertain": material_uncertain,
        "model": model_name,
    }
