"""Pydantic mirrors of shared/protocol.md, the protocol source of truth."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator

RoomId = Annotated[
    str,
    Field(min_length=1, max_length=64, pattern=r"^[a-z0-9-]+$"),
]
RequestId = Annotated[str, Field(min_length=1, max_length=128)]


class BBox(BaseModel):
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    width: float = Field(gt=0, le=1)
    height: float = Field(gt=0, le=1)

    @model_validator(mode="after")
    def stays_inside_frame(self) -> "BBox":
        if self.x + self.width > 1 or self.y + self.height > 1:
            raise ValueError("bbox must stay within the normalized frame")
        return self


class JoinMessage(BaseModel):
    type: Literal["join"]
    request_id: RequestId
    room_id: RoomId
    client_id: Annotated[str, Field(min_length=1, max_length=128)]


class PingMessage(BaseModel):
    type: Literal["ping"]
    request_id: RequestId
    room_id: RoomId


class ExplainRequestMessage(BaseModel):
    type: Literal["explain_request"]
    request_id: RequestId
    room_id: RoomId
    bbox: BBox
    annotated_frame_jpeg_base64: Annotated[str, Field(max_length=4_000_000)]
    crop_jpeg_base64: Annotated[str, Field(max_length=4_000_000)]
    thumbnail_jpeg_base64: Annotated[str, Field(max_length=300_000)]
    audio_pcm16_base64: Annotated[str, Field(max_length=3_000_000)]
    audio_sample_rate_hz: Literal[16000]
    question: Annotated[str, Field(min_length=1, max_length=500)]
    language: Annotated[str, Field(min_length=1, max_length=40)]


class CancelMessage(BaseModel):
    type: Literal["cancel"]
    request_id: RequestId
    room_id: RoomId
    target_request_id: RequestId


class FollowUpMessage(BaseModel):
    type: Literal["follow_up"]
    request_id: RequestId
    room_id: RoomId
    parent_request_id: RequestId
    question: Annotated[str, Field(min_length=1, max_length=500)]
    language: Annotated[str, Field(min_length=1, max_length=40)]


ClientMessage = Annotated[
    JoinMessage | PingMessage | ExplainRequestMessage | CancelMessage | FollowUpMessage,
    Field(discriminator="type"),
]


class AckMessage(BaseModel):
    type: Literal["ack"]
    request_id: str
    room_id: str
    kind: Literal["joined", "pong", "request_received", "cancelled"]
    server_time: str


class TextDeltaMessage(BaseModel):
    type: Literal["text_delta"]
    request_id: str
    seq: int = Field(ge=0)
    delta: str


class GroundingMessage(BaseModel):
    type: Literal["grounding"]
    request_id: str
    grounding_quote: str
    grounding_offset_seconds: float | None
    confidence: float = Field(ge=0, le=1)
    region_label: str


class AudioDeltaMessage(BaseModel):
    type: Literal["audio_delta"]
    request_id: str
    seq: int = Field(ge=0)
    audio_pcm16_base64: str
    audio_sample_rate_hz: int = Field(gt=0)


class DoneMessage(BaseModel):
    type: Literal["done"]
    request_id: str
    latency_ms: int = Field(ge=0)
    audio_available: bool


class ErrorMessage(BaseModel):
    type: Literal["error"]
    request_id: str
    code: str
    message: str
    retryable: bool


ServerMessage = Annotated[
    AckMessage
    | TextDeltaMessage
    | GroundingMessage
    | AudioDeltaMessage
    | DoneMessage
    | ErrorMessage,
    Field(discriminator="type"),
]


class RecapArtifact(BaseModel):
    id: str
    thumbnail_url: str
    question: str
    answer: str
    grounding_quote: str
    timestamp: datetime | None
    latency_ms: int = Field(ge=0)


class RecapResponse(BaseModel):
    room_id: str
    artifacts: list[RecapArtifact]
