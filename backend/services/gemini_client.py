"""Single-file boundary for every Gemini SDK call."""

from collections.abc import AsyncIterator
from typing import Any


async def explain_stream(
    *,
    annotated_frame_jpeg: bytes,
    crop_jpeg: bytes,
    audio_pcm16: bytes,
    question: str,
    language: str,
) -> AsyncIterator[str]:
    del annotated_frame_jpeg, crop_jpeg, audio_pcm16, question, language
    raise RuntimeError("Gemini explain is not enabled")


async def synthesize_speech(*, text: str, language: str) -> bytes:
    del text, language
    raise RuntimeError("Gemini speech is not enabled")


async def health_check() -> dict[str, Any]:
    return {"configured": False, "reason": "Gemini health check is not enabled"}
