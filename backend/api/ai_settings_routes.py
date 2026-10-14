"""API routes for EcoSort AI model and API-key settings."""

from __future__ import annotations

import ipaddress
import os
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from backend.services.ai_settings import (
    AVAILABLE_MODELS,
    get_api_key,
    get_settings,
    save_settings,
)

router = APIRouter(prefix="/api/settings/ai", tags=["AI Settings"])


class AISettingsPayload(BaseModel):
    model: str = Field(min_length=1, max_length=100)
    api_key: str | None = Field(default=None, max_length=500)


class ConnectionTestPayload(BaseModel):
    model: str = Field(min_length=1, max_length=100)
    api_key: str | None = Field(default=None, max_length=500)


def _require_local_access(request: Request) -> None:
    """Restrict settings endpoints to local access by default."""
    allowed = os.getenv("ECOSORT_ALLOW_REMOTE_SETTINGS", "").lower() == "true"

    if allowed:
        # Remote access must be protected by authentication at the deployment layer.
        # Do not enable this on a public server without that protection.
        return

    client_host = request.client.host if request.client else ""
    try:
        if not ipaddress.ip_address(client_host).is_loopback:
            raise HTTPException(
                status_code=403,
                detail="AI settings can only be changed from this computer.",
            )
    except ValueError:
        raise HTTPException(
            status_code=403,
            detail="Could not verify local access to AI settings.",
        ) from None


def _validate_model(model: str) -> None:
    if model not in AVAILABLE_MODELS:
        raise HTTPException(
            status_code=400,
            detail="Select a supported model.",
        )


@router.get("")
def read_ai_settings(request: Request) -> dict[str, Any]:
    _require_local_access(request)
    return get_settings()


@router.put("")
def update_ai_settings(
    payload: AISettingsPayload,
    request: Request,
) -> dict[str, Any]:
    _require_local_access(request)
    _validate_model(payload.model)

    try:
        return save_settings(
            model=payload.model,
            api_key=payload.api_key,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/test")
def test_ai_connection(
    payload: ConnectionTestPayload,
    request: Request,
) -> dict[str, str]:
    _require_local_access(request)
    _validate_model(payload.model)

    api_key = (payload.api_key or "").strip()

    if not api_key:
        try:
            api_key = get_api_key()
        except RuntimeError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        from google import genai

        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=payload.model,
            contents="Reply with the single word OK.",
        )

        if not getattr(response, "text", None):
            raise RuntimeError("The model returned an empty response.")

        return {"status": "success", "message": "Gemini connection successful."}

    except Exception as exc:
        # Return a short error without returning or logging the API key.
        message = str(exc)
        if "401" in message or "403" in message or "API_KEY_INVALID" in message:
            detail = "Authentication failed. Check your Gemini API key."
        elif "404" in message or "NOT_FOUND" in message:
            detail = "Model not found. Check that this model ID is available to your API key."
        elif "429" in message or "RESOURCE_EXHAUSTED" in message:
            detail = "Rate limit or quota reached. Try again later or check your Gemini quota."
        elif "503" in message or "UNAVAILABLE" in message:
            detail = "Gemini is temporarily unavailable. Try again shortly."
        else:
            detail = "Connection failed. Check the API key, model ID, and backend logs."

        raise HTTPException(status_code=502, detail=detail) from None