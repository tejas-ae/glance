"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PcmAudioQueue } from "@/lib/audio";
import type { AudioDeltaMessage } from "@/lib/types";

export type AudioStatus = "locked" | "ready" | "playing";

export function useAudioPlayback() {
  const queueRef = useRef<PcmAudioQueue | null>(null);
  const requestStartedAt = useRef(0);
  const [status, setStatus] = useState<AudioStatus>("locked");
  const [firstAudioMs, setFirstAudioMs] = useState<number | null>(null);

  const unlock = useCallback(() => {
    if (!queueRef.current) {
      queueRef.current = new PcmAudioQueue({
        onFirstPlayback: () => {
          setFirstAudioMs(performance.now() - requestStartedAt.current);
        },
        onPlayingChange: (playing) => {
          setStatus(playing ? "playing" : "ready");
        },
      });
    }
    queueRef.current.unlock();
    setStatus((current) => current === "locked" ? "ready" : current);
  }, []);

  const reset = useCallback((startedAt: number) => {
    requestStartedAt.current = startedAt;
    setFirstAudioMs(null);
    queueRef.current?.reset();
  }, []);

  const enqueue = useCallback((message: AudioDeltaMessage) => {
    queueRef.current?.enqueue(message);
  }, []);

  useEffect(() => {
    return () => {
      queueRef.current?.destroy();
      queueRef.current = null;
    };
  }, []);

  return { status, firstAudioMs, unlock, reset, enqueue };
}
