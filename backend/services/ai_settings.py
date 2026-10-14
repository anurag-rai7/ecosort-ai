from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any

try:
    import keyring
except ImportError:
    keyring = None

SERVICE_NAME = "ecosort-ai"
ACCOUNT_NAME = "gemini-api-key"
SETTINGS_DIR = Path(__file__).resolve().parents[1] / "data"
SETTINGS_FILE = SETTINGS_DIR / "ai_settings.json"
LOCK = threading.RLock()

AVAILABLE_MODELS = {
    "gemini-3-flash-preview": "Gemini 3 Flash (Fast & Recommended)",
    "gemini-3.8-flash": "Gemini 3.8 Flash",
    "gemini-3.5-flash-lite": "Gemini 3.5 Flash-Lite",
    "gemini-3.1-pro-preview": "Gemini 3.1 Pro",
}
DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")
if DEFAULT_MODEL not in AVAILABLE_MODELS:
    DEFAULT_MODEL = "gemini-3-flash-preview"


def _read_data() -> dict[str, Any]:
    try:
        with SETTINGS_FILE.open("r", encoding="utf-8") as file:
            data = json.load(file)
            if isinstance(data, dict):
                return data
    except (OSError, ValueError):
        pass
    return {}


def _save_data(data: dict[str, Any]) -> None:
    SETTINGS_DIR.mkdir(parents=True, exist_ok=True)
    temp_file = SETTINGS_FILE.with_suffix(".tmp")
    try:
        with temp_file.open("w", encoding="utf-8") as file:
            json.dump(data, file, indent=2)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temp_file, SETTINGS_FILE)
    finally:
        if temp_file.exists():
            temp_file.unlink(missing_ok=True)


def get_api_key() -> str:
    key = None
    if keyring is not None:
        try:
            key = keyring.get_password(SERVICE_NAME, ACCOUNT_NAME)
        except Exception:
            key = None

    if not key:
        with LOCK:
            data = _read_data()
            key = data.get("api_key")

    return str(key or os.getenv("GEMINI_API_KEY", "")).strip()


def get_model() -> str:
    with LOCK:
        data = _read_data()
        model = data.get("model", os.getenv("GEMINI_MODEL", DEFAULT_MODEL))
        if model not in AVAILABLE_MODELS:
            model = DEFAULT_MODEL
        return model


def get_settings() -> dict[str, Any]:
    with LOCK:
        return {
            "model": get_model(),
            "api_key_configured": bool(get_api_key()),
            "available_models": [
                {"id": model_id, "name": name}
                for model_id, name in AVAILABLE_MODELS.items()
            ],
        }


def save_settings(model: str, api_key: str | None = None) -> dict[str, Any]:
    if model not in AVAILABLE_MODELS:
        raise ValueError(
            f"Unsupported Gemini model '{model}'. Supported: {', '.join(AVAILABLE_MODELS.keys())}"
        )

    if api_key is not None:
        if not isinstance(api_key, str) or len(api_key) > 500:
            raise ValueError("Invalid API key format.")
        api_key = api_key.strip()

    with LOCK:
        data = _read_data()
        data["model"] = model

        if api_key:
            saved_in_keyring = False
            if keyring is not None:
                try:
                    keyring.set_password(SERVICE_NAME, ACCOUNT_NAME, api_key)
                    saved_in_keyring = True
                except Exception:
                    saved_in_keyring = False

            # If keyring is unavailable or failed, persist in the local settings file
            if not saved_in_keyring:
                data["api_key"] = api_key

        _save_data(data)
        return get_settings()