
from __future__ import annotations

from typing import Any

from google import genai
from google.genai import types

from backend.services.ai_settings import get_api_key, get_model


class ChatServiceError(Exception):
    """Raised when the AI chat service cannot complete a request."""


SYSTEM_INSTRUCTION = """
You are EcoSort AI, a friendly and practical waste-sorting assistant.

Help users understand:
- How to sort and dispose of everyday waste.
- Whether an item can be reused, recycled, or composted.
- Safe handling of electronic and hazardous waste.
- Environmentally responsible disposal practices.

Keep answers clear, concise, and actionable.
When local disposal rules may vary, tell the user to check local municipal guidance.
Do not claim an item is recyclable if its material or local recycling rules are uncertain.
If a question is unrelated to waste, recycling, sustainability, or the environment,
politely redirect the conversation to EcoSort's purpose.
"""


def _normalise_history(history: list[Any] | None) -> list[dict[str, str]]:
    """Convert supported conversation-history formats to Gemini contents."""

    messages: list[dict[str, str]] = []

    if not history:
        return messages

    for item in history:
        if isinstance(item, dict):
            role = str(item.get("role", item.get("sender", ""))).strip().lower()
            text = str(
                item.get("content", item.get("text", item.get("message", "")))
            ).strip()
        else:
            continue

        if not text:
            continue

        if role in {"assistant", "ai", "model", "bot"}:
            gemini_role = "model"
        elif role in {"user", "human"}:
            gemini_role = "user"
        else:
            continue

        messages.append({"role": gemini_role, "parts": [{"text": text}]})

    return messages


def get_chat_reply(
    message: str,
    history: list[Any] | None = None,
) -> dict[str, Any]:
    """Generate a chat response using the currently configured Gemini model."""

    api_key = get_api_key()
    model_name = get_model()

    if not api_key:
        raise ChatServiceError(
            "Gemini API key is not configured. Open AI Settings and add your API key."
        )

    user_message = str(message or "").strip()
    if not user_message:
        raise ChatServiceError("Please enter a message.")

    contents = _normalise_history(history)

    # Avoid duplicating the latest message if the frontend already included it.
    if (
        not contents
        or contents[-1]["role"] != "user"
        or contents[-1]["parts"][0]["text"] != user_message
    ):
        contents.append(
            {"role": "user", "parts": [{"text": user_message}]}
        )

    try:
        client = genai.Client(api_key=api_key)

        response = client.models.generate_content(
            model=model_name,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_INSTRUCTION,
                temperature=0.5,
                max_output_tokens=1024,
            ),
        )

        reply = (response.text or "").strip()

        if not reply:
            raise ChatServiceError(
                "The AI returned an empty response. Please try again."
            )

        return {
            "success": True,
            "reply": reply,
            "model": model_name,
        }

    except ChatServiceError:
        raise
    except Exception as exc:
        message_text = str(exc)
        lowered = message_text.lower()

        if any(term in lowered for term in ("api key", "unauthorized", "401", "403")):
            raise ChatServiceError(
                "Gemini authentication failed. Check the API key in AI Settings."
            ) from exc

        if any(term in lowered for term in ("quota", "429", "rate limit")):
            raise ChatServiceError(
                "Gemini API quota or rate limit reached. Try again later."
            ) from exc

        if any(term in lowered for term in ("not found", "404", "unsupported model")):
            raise ChatServiceError(
                f"The configured Gemini model '{model_name}' is unavailable. "
                "Choose another model in AI Settings."
            ) from exc

        raise ChatServiceError(
            f"Chat request failed: {message_text}"
        ) from exc
