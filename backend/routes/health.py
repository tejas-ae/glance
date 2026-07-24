"""Liveness endpoint with safe runtime configuration details."""

import os
from typing import Any

from fastapi import APIRouter

from services.gemini_client import health_check

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


@router.get("/health/gemini", include_in_schema=False)
async def gemini_health() -> dict[str, Any]:
    return await health_check()
