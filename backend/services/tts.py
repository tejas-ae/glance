"""Concurrent sentence synthesis with ordered PCM delivery."""

import asyncio
import base64
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from models.schemas import AudioDeltaMessage, ExplainRequestMessage
from services.gemini_client import synthesize_speech

SendJson = Callable[[dict[str, Any]], Awaitable[None]]
TTS_SAMPLE_RATE = 24_000
logger = logging.getLogger(__name__)


def create_tts_task(
    request: ExplainRequestMessage,
    sentence: str,
    previous: asyncio.Task[int] | None,
    send_json: SendJson,
) -> asyncio.Task[int]:
    async def synthesize_and_send() -> int:
        try:
            stream = synthesize_speech(
                text=sentence,
                language=request.language,
            )
            if previous is None:
                next_sequence = 0
                async for chunk in stream:
                    await send_audio(
                        send_json,
                        request.request_id,
                        next_sequence,
                        chunk,
                    )
                    next_sequence += 1
                return next_sequence

            chunks = [chunk async for chunk in stream]
            next_sequence = await previous
            for chunk in chunks:
                await send_audio(
                    send_json,
                    request.request_id,
                    next_sequence,
                    chunk,
                )
                next_sequence += 1
            return next_sequence
        except Exception:
            logger.exception("Speech synthesis failed")
            return await previous if previous else 0

    return asyncio.create_task(synthesize_and_send())


async def send_audio(
    send_json: SendJson,
    request_id: str,
    sequence: int,
    audio: bytes,
) -> None:
    message = AudioDeltaMessage(
        type="audio_delta",
        request_id=request_id,
        seq=sequence,
        audio_pcm16_base64=base64.b64encode(audio).decode("ascii"),
        audio_sample_rate_hz=TTS_SAMPLE_RATE,
    )
    await send_json(message.model_dump())
