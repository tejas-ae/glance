"""Liveness endpoint with safe runtime configuration details."""

import os

from fastapi import APIRouter


router = APIRouter(tags=["health"])


@router.get("/health", include_in_schema=False)
@router.get("/healthz")
async def healthz() -> dict[str, str | bool]:
    mock_mode = os.getenv("MOCK_MODE", "true").lower() in {"1", "true", "yes"}
    return {
        "status": "ok",
        "mock_mode": mock_mode,
        "model_explain": os.getenv("MODEL_EXPLAIN", "not-configured"),
    }
