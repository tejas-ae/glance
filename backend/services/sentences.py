"""Incremental sentence boundaries for low-latency speech pipelining."""

import re

BOUNDARY = re.compile(r"""[.!?]["')\]]*\s+""")
ABBREVIATIONS = (
    "e.g.",
    "i.e.",
    "mr.",
    "mrs.",
    "ms.",
    "dr.",
    "prof.",
    "vs.",
    "etc.",
)


class SentenceBuffer:
    def __init__(self, minimum_chars: int = 25) -> None:
        self.buffer = ""
        self.minimum_chars = minimum_chars

    def feed(self, text: str) -> list[str]:
        self.buffer += text
        sentences: list[str] = []
        while True:
            boundary = self._next_boundary()
            if boundary is None:
                return sentences
            sentence = self.buffer[:boundary].strip()
            self.buffer = self.buffer[boundary:]
            if sentence:
                sentences.append(sentence)

    def finish(self) -> str:
        remaining = self.buffer.strip()
        self.buffer = ""
        return remaining

    def _next_boundary(self) -> int | None:
        for match in BOUNDARY.finditer(self.buffer):
            candidate = self.buffer[:match.end()].strip()
            if len(candidate) < self.minimum_chars:
                continue
            lowered = candidate.lower().rstrip("\"')]} ")
            if lowered.endswith(ABBREVIATIONS):
                continue
            return match.end()
        return None
