"""Direct in-process explanation orchestration."""

import asyncio
import base64
import re
from collections.abc import Awaitable, Callable
from time import perf_counter
from typing import Any

from mock.canned import (
    CANNED_EXPLANATION,
    CANNED_GROUNDING_QUOTE,
    CANNED_REGION_LABEL,
)
from models.schemas import (
    DoneMessage,
    ExplainRequestMessage,
    GroundingMessage,
    TextDeltaMessage,
)
from services.gemini_client import explain_stream
from services.response_parser import SentinelParser
from services.sentences import SentenceBuffer
from services.store import queue_artifact
from services.tts import create_tts_task

SendJson = Callable[[dict[str, Any]], Awaitable[None]]


async def stream_explanation(
    request: ExplainRequestMessage,
    send_json: SendJson,
    *,
    mock_mode: bool,
) -> None:
    if mock_mode:
        await stream_mock_explanation(request, send_json)
    else:
        await stream_real_explanation(request, send_json)


async def stream_mock_explanation(
    request: ExplainRequestMessage,
    send_json: SendJson,
) -> None:
    started_at = perf_counter()
    await asyncio.sleep(0.28)

    tokens = re.findall(r"\S+\s*", CANNED_EXPLANATION)
    for sequence, token in enumerate(tokens):
        await send_text(send_json, request.request_id, sequence, token)
        await asyncio.sleep(0.04)

    await send_grounding(
        send_json,
        request.request_id,
        {
            "grounding_quote": CANNED_GROUNDING_QUOTE,
            "grounding_offset_seconds": -18.0,
            "confidence": 0.94,
            "region_label": CANNED_REGION_LABEL,
        },
    )
    queue_artifact(
        room_id=request.room_id,
        request_id=request.request_id,
        thumbnail_jpeg_base64=request.thumbnail_jpeg_base64,
        question=request.question,
        answer=CANNED_EXPLANATION,
        grounding_quote=CANNED_GROUNDING_QUOTE,
        latency_ms=elapsed_ms(started_at),
    )
    await send_done(send_json, request.request_id, started_at, False)


async def stream_real_explanation(
    request: ExplainRequestMessage,
    send_json: SendJson,
) -> None:
    started_at = perf_counter()
    parser = SentinelParser()
    sentences = SentenceBuffer()
    tts_tasks: list[asyncio.Task[int]] = []
    answer_parts: list[str] = []
    sequence = 0
    chunks = explain_stream(
        annotated_frame_jpeg=decode_base64(
            request.annotated_frame_jpeg_base64
        ),
        crop_jpeg=decode_base64(request.crop_jpeg_base64),
        audio_pcm16=decode_base64(request.audio_pcm16_base64),
        question=request.question,
        language=request.language,
    )
    try:
        async for chunk in chunks:
            explanation_text = parser.feed(chunk)
            if explanation_text:
                answer_parts.append(explanation_text)
                await send_text(
                    send_json,
                    request.request_id,
                    sequence,
                    explanation_text,
                )
                sequence += 1
                for sentence in sentences.feed(explanation_text):
                    tts_tasks.append(
                        create_tts_task(
                            request,
                            sentence,
                            tts_tasks[-1] if tts_tasks else None,
                            send_json,
                        )
                    )

        remaining = sentences.finish()
        if remaining:
            tts_tasks.append(
                create_tts_task(
                    request,
                    remaining,
                    tts_tasks[-1] if tts_tasks else None,
                    send_json,
                )
            )
        metadata = parser.finish()
        await send_grounding(send_json, request.request_id, metadata)
        queue_artifact(
            room_id=request.room_id,
            request_id=request.request_id,
            thumbnail_jpeg_base64=request.thumbnail_jpeg_base64,
            question=request.question,
            answer="".join(answer_parts).strip(),
            grounding_quote=metadata["grounding_quote"],
            latency_ms=elapsed_ms(started_at),
        )
        audio_results = await asyncio.gather(*tts_tasks) if tts_tasks else []
        await send_done(
            send_json,
            request.request_id,
            started_at,
            any(result > 0 for result in audio_results),
        )
    except BaseException:
        for task in tts_tasks:
            task.cancel()
        raise


async def send_text(
    send_json: SendJson,
    request_id: str,
    sequence: int,
    delta: str,
) -> None:
    message = TextDeltaMessage(
        type="text_delta",
        request_id=request_id,
        seq=sequence,
        delta=delta,
    )
    await send_json(message.model_dump())


async def send_grounding(
    send_json: SendJson,
    request_id: str,
    metadata: dict[str, Any],
) -> None:
    message = GroundingMessage(
        type="grounding",
        request_id=request_id,
        **metadata,
    )
    await send_json(message.model_dump())


async def send_done(
    send_json: SendJson,
    request_id: str,
    started_at: float,
    audio_available: bool,
) -> None:
    message = DoneMessage(
        type="done",
        request_id=request_id,
        latency_ms=round((perf_counter() - started_at) * 1000),
        audio_available=audio_available,
    )
    await send_json(message.model_dump())


def decode_base64(value: str) -> bytes:
    return base64.b64decode(value, validate=True) if value else b""


def elapsed_ms(started_at: float) -> int:
    return round((perf_counter() - started_at) * 1000)
