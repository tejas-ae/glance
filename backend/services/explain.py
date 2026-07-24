"""Direct in-process explanation orchestration."""

import asyncio
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
    GroundingMessage,
    TextDeltaMessage,
)

SendJson = Callable[[dict[str, Any]], Awaitable[None]]


async def stream_mock_explanation(request_id: str, send_json: SendJson) -> None:
    """Replay a plausible response with model-like token pacing."""
    started_at = perf_counter()
    await asyncio.sleep(0.28)

    tokens = re.findall(r"\S+\s*", CANNED_EXPLANATION)
    for sequence, token in enumerate(tokens):
        delta = TextDeltaMessage(
            type="text_delta",
            request_id=request_id,
            seq=sequence,
            delta=token,
        )
        await send_json(delta.model_dump())
        await asyncio.sleep(0.04)

    grounding = GroundingMessage(
        type="grounding",
        request_id=request_id,
        grounding_quote=CANNED_GROUNDING_QUOTE,
        grounding_offset_seconds=-18.0,
        confidence=0.94,
        region_label=CANNED_REGION_LABEL,
    )
    await send_json(grounding.model_dump())

    elapsed_ms = round((perf_counter() - started_at) * 1000)
    done = DoneMessage(
        type="done",
        request_id=request_id,
        latency_ms=elapsed_ms,
    )
    await send_json(done.model_dump())
