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

SendJson = Callable[[dict[str, Any]], Awaitable[None]]


async def stream_explanation(
    request: ExplainRequestMessage,
    send_json: SendJson,
    *,
    mock_mode: bool,
) -> None:
    if mock_mode:
        await stream_mock_explanation(request.request_id, send_json)
    else:
        await stream_real_explanation(request, send_json)


async def stream_mock_explanation(request_id: str, send_json: SendJson) -> None:
    started_at = perf_counter()
    await asyncio.sleep(0.28)

    tokens = re.findall(r"\S+\s*", CANNED_EXPLANATION)
    for sequence, token in enumerate(tokens):
        await send_text(send_json, request_id, sequence, token)
        await asyncio.sleep(0.04)

    await send_grounding(
        send_json,
        request_id,
        {
            "grounding_quote": CANNED_GROUNDING_QUOTE,
            "grounding_offset_seconds": -18.0,
            "confidence": 0.94,
            "region_label": CANNED_REGION_LABEL,
        },
    )
    await send_done(send_json, request_id, started_at)


async def stream_real_explanation(
    request: ExplainRequestMessage,
    send_json: SendJson,
) -> None:
    started_at = perf_counter()
    parser = SentinelParser()
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
    async for chunk in chunks:
        explanation_text = parser.feed(chunk)
        if explanation_text:
            await send_text(
                send_json,
                request.request_id,
                sequence,
                explanation_text,
            )
            sequence += 1

    await send_grounding(send_json, request.request_id, parser.finish())
    await send_done(send_json, request.request_id, started_at)


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
) -> None:
    message = DoneMessage(
        type="done",
        request_id=request_id,
        latency_ms=round((perf_counter() - started_at) * 1000),
    )
    await send_json(message.model_dump())


def decode_base64(value: str) -> bytes:
    return base64.b64decode(value, validate=True) if value else b""
