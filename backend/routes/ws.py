"""Room-scoped WebSocket gateway."""

from datetime import UTC, datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import TypeAdapter, ValidationError

from models.schemas import (
    AckMessage,
    ClientMessage,
    ErrorMessage,
    JoinMessage,
    PingMessage,
)

router = APIRouter()
client_message_adapter = TypeAdapter(ClientMessage)


@router.websocket("/ws")
async def websocket_gateway(websocket: WebSocket) -> None:
    await websocket.accept()
    joined_room: str | None = None

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
                error = ErrorMessage(
                    type="error",
                    request_id=request_id,
                    code="INVALID_MESSAGE",
                    message="Message does not match the WebSocket protocol.",
                    retryable=False,
                )
                await websocket.send_json(error.model_dump())
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
                await websocket.send_json(ack.model_dump())
                continue

            if joined_room is None or message.room_id != joined_room:
                error = ErrorMessage(
                    type="error",
                    request_id=message.request_id,
                    code="JOIN_REQUIRED",
                    message="Join the requested room before sending messages.",
                    retryable=True,
                )
                await websocket.send_json(error.model_dump())
                continue

            if isinstance(message, PingMessage):
                ack = AckMessage(
                    type="ack",
                    request_id=message.request_id,
                    room_id=joined_room,
                    kind="pong",
                    server_time=datetime.now(UTC).isoformat(),
                )
                await websocket.send_json(ack.model_dump())
                continue

            error = ErrorMessage(
                type="error",
                request_id=message.request_id,
                code="NOT_ENABLED",
                message="Explanation requests are not enabled.",
                retryable=False,
            )
            await websocket.send_json(error.model_dump())
    except WebSocketDisconnect:
        return
