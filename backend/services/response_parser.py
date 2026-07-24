"""Incremental parser for explanation text followed by sentinel metadata."""

import json
from typing import Any

SENTINEL = "---META---"


class SentinelParser:
    def __init__(self) -> None:
        self.pending = ""
        self.metadata_text = ""
        self.reading_metadata = False

    def feed(self, chunk: str) -> str:
        if self.reading_metadata:
            self.metadata_text += chunk
            return ""

        self.pending += chunk
        if SENTINEL in self.pending:
            explanation, metadata = self.pending.split(SENTINEL, 1)
            self.pending = ""
            self.metadata_text += metadata
            self.reading_metadata = True
            return explanation

        safe_length = max(0, len(self.pending) - len(SENTINEL) + 1)
        safe_text = self.pending[:safe_length]
        self.pending = self.pending[safe_length:]
        return safe_text

    def finish(self) -> dict[str, Any]:
        if not self.reading_metadata:
            raise ValueError("Model response did not include metadata sentinel")

        raw = self.metadata_text.strip()
        if raw.startswith("```"):
            raw = raw.removeprefix("```json").removeprefix("```")
            raw = raw.removesuffix("```").strip()
        metadata = json.loads(raw)
        confidence = max(0.0, min(1.0, float(metadata["confidence"])))
        offset = metadata.get("grounding_offset_seconds")
        return {
            "grounding_quote": str(metadata.get("grounding_quote", "")),
            "grounding_offset_seconds": None if offset is None else float(offset),
            "confidence": confidence,
            "region_label": str(metadata["region_label"]),
        }
