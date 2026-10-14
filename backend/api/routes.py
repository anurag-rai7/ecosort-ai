from __future__ import annotations

import os
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from backend.services.ai_settings import (
    AVAILABLE_MODELS,
    get_api_key,
    get_settings,
    save_settings,
)
from backend.services.chat import ChatServiceError, get_chat_reply
from backend.services.classification import ClassificationError, classify_waste
from backend.services.disposal import (
    DisposalRulesError,
    get_disposal_guidance,
    get_disposal_info,
)
from backend.services.vision import VisionServiceError


router = APIRouter(prefix="/api", tags=["EcoSort API"])


class ChatMessage(BaseModel):
    role: str = Field(..., min_length=1, max_length=20)
    content: str = Field(..., min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    history: list[ChatMessage] = Field(default_factory=list)


class AISettingsRequest(BaseModel):
    model: str = Field(..., min_length=1, max_length=100)
    api_key: str | None = Field(default=None, max_length=500)


class AITestRequest(BaseModel):
    model: str = Field(..., min_length=1, max_length=100)
    api_key: str | None = Field(default=None, max_length=500)


@router.get("/health")
@router.get("/status")
async def health_check() -> dict[str, Any]:
    return {
        "status": "ok",
        "app": "EcoSort AI",
        "message": "EcoSort AI API is running",
    }


@router.get("/settings/ai")
async def get_ai_settings_endpoint() -> dict[str, Any]:
    settings = get_settings()
    return {
        "success": True,
        "model": settings["model"],
        "api_key_configured": settings["api_key_configured"],
        "available_models": settings["available_models"],
    }


@router.put("/settings/ai")
async def update_ai_settings_endpoint(request: AISettingsRequest) -> dict[str, Any]:
    try:
        settings = save_settings(
            model=request.model,
            api_key=request.api_key,
        )
        return {
            "success": True,
            "message": "AI settings saved successfully.",
            **settings,
        }
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Unable to save AI settings: {exc}",
        ) from exc


@router.post("/settings/ai/test")
async def test_ai_connection_endpoint(request: AITestRequest) -> dict[str, Any]:
    from google import genai
    from google.genai import types

    api_key = (request.api_key or "").strip() or get_api_key()

    if not api_key:
        raise HTTPException(
            status_code=400,
            detail="Enter a Gemini API key before testing the connection.",
        )

    if request.model not in AVAILABLE_MODELS:
        raise HTTPException(
            status_code=400,
            detail=f"Select a supported model ({', '.join(AVAILABLE_MODELS.keys())}).",
        )

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=request.model,
            contents="Respond with OK.",
            config=types.GenerateContentConfig(
                temperature=0,
                max_output_tokens=10,
            ),
        )

        reply = (response.text or "").strip()
        if not reply:
            raise HTTPException(
                status_code=502,
                detail="The model returned an empty response.",
            )

        return {
            "success": True,
            "message": f"Gemini connection successful using {request.model}.",
            "model": request.model,
        }

    except HTTPException:
        raise
    except Exception as exc:
        message = str(exc)
        lowered = message.lower()

        if any(term in lowered for term in ("api key", "unauthorized", "401", "403")):
            detail = "Authentication failed. Check your Gemini API key."
        elif any(term in lowered for term in ("quota", "429", "rate limit")):
            detail = "Gemini API quota or rate limit reached."
        elif any(term in lowered for term in ("not found", "404", "unsupported model")):
            detail = f"Model '{request.model}' is unavailable for this API key."
        elif "503" in lowered or "unavailable" in lowered:
            detail = f"Gemini service is temporarily busy. Please retry shortly."
        else:
            detail = f"Connection test failed: {message}"

        raise HTTPException(status_code=502, detail=detail) from exc


@router.post("/classify")
async def classify_image_endpoint(file: UploadFile = File(...)) -> dict[str, Any]:
    allowed_content_types = {
        "image/jpeg",
        "image/png",
        "image/webp",
    }

    if file.content_type not in allowed_content_types:
        raise HTTPException(
            status_code=415,
            detail="Unsupported image type. Upload JPG, PNG, or WEBP.",
        )

    try:
        image_bytes = await file.read(10 * 1024 * 1024 + 1)

        if not image_bytes:
            raise HTTPException(status_code=400, detail="Uploaded image is empty.")

        if len(image_bytes) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail="Image must be 10 MB or smaller.",
            )

        return classify_waste(image_bytes)

    except HTTPException:
        raise
    except (ClassificationError, VisionServiceError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Image classification failed: {exc}",
        ) from exc
    finally:
        await file.close()


@router.get("/disposal/{category}")
async def disposal_information(category: str) -> dict[str, Any]:
    try:
        result = get_disposal_info(category)
        if result is None:
            raise HTTPException(
                status_code=404,
                detail=f"No disposal information found for '{category}'.",
            )
        return result
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve disposal information.",
        ) from exc


@router.post("/chat")
async def chat_endpoint(request: ChatRequest) -> dict[str, Any]:
    try:
        history = [item.model_dump() for item in request.history]
        return get_chat_reply(request.message, history)
    except ChatServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Chat request failed: {exc}",
        ) from exc
