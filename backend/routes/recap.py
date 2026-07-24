"""Read-only room recap endpoint."""

import logging

from fastapi import APIRouter, HTTPException

from models.schemas import RecapArtifact, RecapResponse
from services.store import list_artifacts

router = APIRouter(prefix="/rooms", tags=["recap"])
logger = logging.getLogger(__name__)


@router.get("/{room_id}/recap", response_model=RecapResponse)
async def room_recap(room_id: str) -> RecapResponse:
    try:
        artifacts = await list_artifacts(room_id)
        return RecapResponse(
            room_id=room_id,
            artifacts=[RecapArtifact.model_validate(item) for item in artifacts],
        )
    except Exception as error:
        logger.exception("Firestore recap read failed")
        raise HTTPException(
            status_code=503,
            detail="The room recap is temporarily unavailable.",
        ) from error
