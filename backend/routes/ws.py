"""Room-scoped WebSocket gateway."""

import asyncio
import logging
import os
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import TypeAdapter, ValidationError

from models.schemas import (
    AckMessage,
    ClientMessage,
    ErrorMessage,
    ExplainRequestMessage,
    JoinMessage,
    PingMessage,
)
from services.explain import stream_explanation

router = APIRouter()
client_message_adapter = TypeAdapter(ClientMessage)
logger = logging.getLogger(__name__)


@router.websocket("/ws")
async def websocket_gateway(websocket: WebSocket) -> None:
    await websocket.accept()
    joined_room: str | None = None
    active_explanation: asyncio.Task[None] | None = None
    send_lock = asyncio.Lock()

    async def send_json(payload: dict[str, Any]) -> None:
        async with send_lock:
            await websocket.send_json(payload)

    async def run_explanation(message: ExplainRequestMessage) -> None:
        try:
            await stream_explanation(
                message,
                send_json,
                mock_mode=env_flag("MOCK_MODE", True),
            )
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Explanation request failed")
            await send_error(
                send_json,
                message.request_id,
                "EXPLAIN_FAILED",
                "The explanation service failed. Please try again.",
                True,
            )

    try:
        while True:
            raw_message = await websocket.receive_json()
            request_id = (
                raw_message.get("request_id")
                if isinstance(raw_message, dict)
                else None
            )
            try:
                message = client_message_adapter.validate_python(raw_message)
            except ValidationError:
                if not isinstance(request_id, str):
                    await websocket.close(code=1008, reason="Invalid message")
                    return
                await send_error(
                    send_json,
                    request_id,
                    "INVALID_MESSAGE",
                    "Message does not match the WebSocket protocol.",
                    False,
                )
                continue

            if isinstance(message, JoinMessage):
                joined_room = message.room_id
                ack = AckMessage(
                    type="ack",
                    request_id=message.request_id,
                    room_id=message.room_id,
                    kind="joined",
                    server_time=datetime.now(UTC).isoformat(),
                )
                await send_json(ack.model_dump())
                continue

            if joined_room is None or message.room_id != joined_room:
                await send_error(
                    send_json,
                    message.request_id,
                    "JOIN_REQUIRED",
                    "Join the requested room before sending messages.",
                    True,
                )
                continue

            if isinstance(message, PingMessage):
                ack = AckMessage(
                    type="ack",
                    request_id=message.request_id,
                    room_id=joined_room,
                    kind="pong",
                    server_time=datetime.now(UTC).isoformat(),
                )
                await send_json(ack.model_dump())
                continue

            if isinstance(message, ExplainRequestMessage):
                if active_explanation:
                    active_explanation.cancel()
                ack = AckMessage(
                    type="ack",
                    request_id=message.request_id,
                    room_id=joined_room,
                    kind="request_received",
                    server_time=datetime.now(UTC).isoformat(),
                )
                await send_json(ack.model_dump())
                active_explanation = asyncio.create_task(run_explanation(message))
                continue

            await send_error(
                send_json,
                message.request_id,
                "NOT_ENABLED",
                "Follow-up questions are not enabled.",
                False,
            )
    except WebSocketDisconnect:
        return
    finally:
        if active_explanation:
            active_explanation.cancel()


async def send_error(
    send_json: Any,
    request_id: str,
    code: str,
    message: str,
    retryable: bool,
) -> None:
    error = ErrorMessage(
        type="error",
        request_id=request_id,
        code=code,
        message=message,
        retryable=retryable,
    )
    await send_json(error.model_dump())


def env_flag(name: str, default: bool) -> bool:
    value = os.getenv(name)
    return default if value is None else value.lower() in {"1", "true", "yes"}
