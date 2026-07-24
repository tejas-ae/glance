"""Fire-and-forget Firestore storage for room recap artifacts."""

import asyncio
import logging
import os
from typing import Any

from google.cloud import firestore
from google.cloud.firestore_v1 import AsyncClient

logger = logging.getLogger(__name__)
_client: AsyncClient | None = None
_pending_writes: set[asyncio.Task[None]] = set()


def queue_artifact(
    *,
    room_id: str,
    request_id: str,
    thumbnail_jpeg_base64: str,
    question: str,
    answer: str,
    grounding_quote: str,
    latency_ms: int,
) -> None:
    """Schedule a write without adding Firestore latency to the response."""
    if not _configured():
        logger.info("Firestore is not configured; recap artifact was not stored")
        return
    task = asyncio.create_task(
        _save_artifact(
            room_id=room_id,
            request_id=request_id,
            thumbnail_jpeg_base64=thumbnail_jpeg_base64,
            question=question,
            answer=answer,
            grounding_quote=grounding_quote,
            latency_ms=latency_ms,
        )
    )
    _pending_writes.add(task)
    task.add_done_callback(_pending_writes.discard)


async def list_artifacts(room_id: str) -> list[dict[str, Any]]:
    if not _configured():
        raise RuntimeError("Firestore is not configured")
    query = _taps(room_id).order_by("timestamp").limit(100)
    snapshots = await query.get()
    return [{"id": snapshot.id, **(snapshot.to_dict() or {})} for snapshot in snapshots]


async def _save_artifact(
    *,
    room_id: str,
    request_id: str,
    thumbnail_jpeg_base64: str,
    question: str,
    answer: str,
    grounding_quote: str,
    latency_ms: int,
) -> None:
    try:
        await _taps(room_id).document(request_id).set(
            {
                "thumbnail_url": (
                    f"data:image/jpeg;base64,{thumbnail_jpeg_base64}"
                ),
                "question": question,
                "answer": answer,
                "grounding_quote": grounding_quote,
                "timestamp": firestore.SERVER_TIMESTAMP,
                "latency_ms": latency_ms,
            }
        )
    except Exception:
        logger.exception("Firestore artifact write failed")


def _taps(room_id: str):
    collection = os.getenv("FIRESTORE_COLLECTION", "rooms")
    return _get_client().collection(collection).document(room_id).collection("taps")


def _get_client() -> AsyncClient:
    global _client
    if _client is None:
        _client = AsyncClient(project=os.getenv("GOOGLE_CLOUD_PROJECT") or None)
    return _client


def _configured() -> bool:
    return bool(
        os.getenv("GOOGLE_CLOUD_PROJECT")
        or os.getenv("FIRESTORE_EMULATOR_HOST")
    )
