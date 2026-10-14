from __future__ import annotations

import json
from pathlib import Path
from typing import Any

BACKEND_DIR = Path(__file__).resolve().parents[1]
RULES_FILE = BACKEND_DIR / "data" / "waste_rules.json"

CATEGORY_ALIASES: dict[str, str] = {
    "plastic": "plastic_bottle",
    "plastic_bottle": "plastic_bottle",
    "plastic_bottles": "plastic_bottle",
    "paper": "paper_cardboard",
    "cardboard": "paper_cardboard",
    "paper_cardboard": "paper_cardboard",
    "glass": "glass",
    "glass_bottle": "glass",
    "metal": "metal_can",
    "can": "metal_can",
    "cans": "metal_can",
    "metal_can": "metal_can",
    "metal_cans": "metal_can",
    "organic": "organic_waste",
    "organic_waste": "organic_waste",
    "food": "organic_waste",
    "food_waste": "organic_waste",
    "compost": "organic_waste",
    "ewaste": "electronic_waste",
    "e-waste": "electronic_waste",
    "electronic": "electronic_waste",
    "electronic_waste": "electronic_waste",
    "battery": "electronic_waste",
    "batteries": "electronic_waste",
    "textile": "textile",
    "textiles": "textile",
    "clothes": "textile",
    "clothing": "textile",
    "hazardous": "hazardous",
    "hazard": "hazardous",
    "toxic": "hazardous",
    "chemical": "hazardous",
    "other": "general_waste",
    "general": "general_waste",
    "general_waste": "general_waste",
    "trash": "general_waste",
    "landfill": "general_waste",
}


class DisposalRulesError(Exception):
    """Raised when disposal guidance cannot be loaded or validated."""


def load_waste_rules() -> dict[str, Any]:
    """Load the shared waste-disposal rules from JSON."""
    try:
        with RULES_FILE.open("r", encoding="utf-8") as file:
            rules = json.load(file)
    except (OSError, json.JSONDecodeError) as exc:
        raise DisposalRulesError(
            "Waste disposal guidance is currently unavailable."
        ) from exc

    if not isinstance(rules, dict):
        raise DisposalRulesError("The waste rules file must contain a JSON object.")

    return rules


def get_disposal_guidance(category: str) -> dict[str, Any]:
    """Return disposal guidance for a recognized waste category."""
    if not isinstance(category, str) or not category.strip():
        raise DisposalRulesError("A valid waste category is required.")

    raw_category = category.strip().lower()
    canonical_category = CATEGORY_ALIASES.get(raw_category, raw_category)

    rules = load_waste_rules()
    guidance = rules.get(canonical_category)

    if not isinstance(guidance, dict):
        raise DisposalRulesError(
            f"No disposal guidance is available for category: {category}."
        )

    display_name = guidance.get("display_name", canonical_category.replace("_", " ").title())
    disposal_category = guidance.get("category", "General Guidance")
    instructions = guidance.get("instructions", [])
    caution = guidance.get("caution", "")

    if not isinstance(instructions, list) or not instructions:
        instructions = ["Check with your local waste management facility for specific disposal guidelines."]

    return {
        "category": canonical_category,
        "display_name": display_name,
        "disposal_category": disposal_category,
        "instructions": instructions,
        "caution": caution,
    }


def get_disposal_info(category: str) -> dict[str, Any] | None:
    """Convenience alias for get_disposal_guidance used by API routes."""
    try:
        return get_disposal_guidance(category)
    except DisposalRulesError:
        return None
