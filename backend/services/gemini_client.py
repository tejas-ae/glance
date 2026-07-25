"""Single-file boundary for every Gemini SDK call."""

import os
from collections.abc import AsyncIterator
from importlib.metadata import version
from typing import Any

from google import genai
from google.genai import types

from services.audio_format import pcm_to_wav
from services.prompts import EXPLAIN_SYSTEM_PROMPT, describe_audio

_client: genai.Client | None = None
PCM_SAMPLE_RATE_HZ = 16_000
PCM_BYTES_PER_SAMPLE = 2
LANGUAGE_CODES = {
    "English": "en-US",
    "Spanish": "es-US",
    "French": "fr-FR",
    "German": "de-DE",
    "Italian": "it-IT",
    "Portuguese": "pt-BR",
    "Hindi": "hi-IN",
    "Japanese": "ja-JP",
    "Korean": "ko-KR",
    "Mandarin Chinese": "cmn-CN",
}


async def explain_stream(
    *,
    annotated_frame_jpeg: bytes,
    crop_jpeg: bytes,
    audio_pcm16: bytes,
    question: str,
    language: str,
) -> AsyncIterator[str]:
    """Stream one multimodal explanation, falling back before first output."""
    client = _get_client()
    parts = [
        types.Part.from_text(text="Annotated full screen with selected region:"),
        types.Part.from_bytes(
            data=annotated_frame_jpeg,
            mime_type="image/jpeg",
        ),
        types.Part.from_text(text="Tight crop of the selected region:"),
        types.Part.from_bytes(data=crop_jpeg, mime_type="image/jpeg"),
    ]
    if audio_pcm16:
        parts.extend(
            [
                types.Part.from_text(
                    text="Recent meeting audio, oldest to newest:"
                ),
                types.Part.from_bytes(
                    data=pcm_to_wav(audio_pcm16),
                    mime_type="audio/wav",
                ),
            ]
        )
    else:
        parts.append(types.Part.from_text(text="No meeting audio was provided."))
    parts.append(types.Part.from_text(text=f"User question: {question}"))
    contents = types.Content(role="user", parts=parts)
    audio_seconds = len(audio_pcm16) / PCM_BYTES_PER_SAMPLE / PCM_SAMPLE_RATE_HZ
    config = types.GenerateContentConfig(
        system_instruction=EXPLAIN_SYSTEM_PROMPT.format(
            language=language,
            audio_description=describe_audio(audio_seconds),
        ),
        max_output_tokens=1_024,
        thinking_config=types.ThinkingConfig(
            thinking_level=types.ThinkingLevel.MINIMAL,
        ),
    )

    model_ids = _model_ids()
    last_error: Exception | None = None
    for index, model_id in enumerate(model_ids):
        emitted = False
        try:
            stream = await client.aio.models.generate_content_stream(
                model=model_id,
                contents=contents,
                config=config,
            )
            async for chunk in stream:
                text = getattr(chunk, "text", None)
                if text:
                    emitted = True
                    yield text
            return
        except Exception as error:
            last_error = error
            if emitted or index == len(model_ids) - 1:
                raise
    if last_error:
        raise last_error


async def synthesize_speech(
    *,
    text: str,
    language: str,
) -> AsyncIterator[bytes]:
    """Stream one sentence as raw 24 kHz mono Int16 PCM chunks."""
    model_id = os.getenv("MODEL_TTS")
    if not model_id:
        raise RuntimeError("MODEL_TTS is not configured")
    stream = await _get_client().aio.models.generate_content_stream(
        model=model_id,
        contents=f"Read naturally in {language}, using only these words:\n{text}",
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                language_code=LANGUAGE_CODES.get(language, "en-US"),
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name="Kore"
                    ),
                ),
            ),
        ),
    )
    emitted = False
    first_packet = True
    buffered = bytearray()
    async for chunk in stream:
        try:
            data = chunk.candidates[0].content.parts[0].inline_data.data
        except (AttributeError, IndexError, TypeError):
            continue
        if data:
            emitted = True
            buffered.extend(data)
            if first_packet or len(buffered) >= 4_800:
                yield bytes(buffered)
                buffered.clear()
                first_packet = False
    if buffered:
        yield bytes(buffered)
    if not emitted:
        raise RuntimeError("Gemini TTS returned no audio")


async def health_check() -> dict[str, Any]:
    """Verify configured credentials and resolve an explanation model."""
    configured = bool(os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_CLOUD_PROJECT"))
    result: dict[str, Any] = {
        "configured": configured,
        "sdk_version": version("google-genai"),
        "models": _model_ids(required=False),
    }
    if not configured:
        result["reason"] = "Set GOOGLE_API_KEY or GOOGLE_CLOUD_PROJECT."
        return result

    errors: list[str] = []
    for model_id in _model_ids():
        try:
            model = await _get_client().aio.models.get(model=model_id)
            result["available_model"] = getattr(model, "name", model_id)
            return result
        except Exception as error:
            status = getattr(error, "status_code", None) or getattr(error, "code", None)
            message = " ".join(str(error).split())[:180]
            errors.append(
                f"{model_id}: {type(error).__name__}"
                f"{f' ({status})' if status else ''}: {message}"
            )
    result["reason"] = "; ".join(errors)
    return result


def _get_client() -> genai.Client:
    global _client
    if _client is not None:
        return _client

    api_key = os.getenv("GOOGLE_API_KEY")
    project = os.getenv("GOOGLE_CLOUD_PROJECT")
    if api_key:
        _client = genai.Client(api_key=api_key)
    elif project:
        _client = genai.Client(
            vertexai=True,
            project=project,
            location=os.getenv("GOOGLE_CLOUD_LOCATION", "global"),
        )
    else:
        raise RuntimeError("Gemini credentials are not configured")
    return _client


def _model_ids(required: bool = True) -> list[str]:
    primary = os.getenv("MODEL_EXPLAIN")
    fallback = os.getenv("MODEL_EXPLAIN_FALLBACK")
    if required and not primary:
        raise RuntimeError("MODEL_EXPLAIN is not configured")
    return [model for model in (primary, fallback) if model]
