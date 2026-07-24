"""Pydantic mirrors of shared/protocol.md, the protocol source of truth."""

from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator


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
    request_id: str
    room_id: str
    client_id: str


class ExplainRequestMessage(BaseModel):
    type: Literal["explain_request"]
    request_id: str
    room_id: str
    bbox: BBox
    annotated_frame_jpeg_base64: str
    crop_jpeg_base64: str
    audio_pcm16_base64: str
    audio_sample_rate_hz: Literal[16000]
    question: str
    language: str


class FollowUpMessage(BaseModel):
    type: Literal["follow_up"]
    request_id: str
    room_id: str
    parent_request_id: str
    question: str
    language: str


ClientMessage = Annotated[
    JoinMessage | ExplainRequestMessage | FollowUpMessage,
    Field(discriminator="type"),
]


class AckMessage(BaseModel):
    type: Literal["ack"]
    request_id: str
    room_id: str
    kind: Literal["joined", "request_received"]
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
