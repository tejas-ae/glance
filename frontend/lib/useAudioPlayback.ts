"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PcmAudioQueue, type QueueStatus } from "@/lib/audio";
import type { AudioDeltaMessage } from "@/lib/types";

export type AudioStatus = "locked" | "ready" | "playing" | "paused" | "unavailable";

export function useAudioPlayback() {
  const queueRef = useRef<PcmAudioQueue | null>(null);
  const requestStartedAt = useRef(0);
  const [status, setStatus] = useState<AudioStatus>("locked");
  const [firstAudioMs, setFirstAudioMs] = useState<number | null>(null);

  const applyQueueStatus = useCallback((queueStatus: QueueStatus) => {
    setStatus((current) => {
      if (queueStatus === "playing") return "playing";
      if (queueStatus === "paused") return "paused";
      // "idle": fall back to whichever non-transient state applies.
      return current === "locked" ? "locked" : current === "unavailable" ? "unavailable" : "ready";
    });
  }, []);

  const unlock = useCallback(() => {
    if (!queueRef.current) {
      queueRef.current = new PcmAudioQueue({
        onFirstPlayback: () => {
          setFirstAudioMs(performance.now() - requestStartedAt.current);
        },
        onStatusChange: applyQueueStatus,
      });
    }
    queueRef.current.unlock();
    setStatus((current) => current === "locked" ? "ready" : current);
  }, [applyQueueStatus]);

  const reset = useCallback((startedAt: number) => {
    requestStartedAt.current = startedAt;
    setFirstAudioMs(null);
    queueRef.current?.reset();
  }, []);

  const enqueue = useCallback((message: AudioDeltaMessage) => {
    queueRef.current?.enqueue(message);
  }, []);

  const pause = useCallback(() => {
    queueRef.current?.pause();
  }, []);

  const resume = useCallback(() => {
    queueRef.current?.resumePlayback();
  }, []);

  const markUnavailable = useCallback(() => {
    setStatus("unavailable");
  }, []);

  useEffect(() => {
    return () => {
      queueRef.current?.destroy();
      queueRef.current = null;
    };
  }, []);

  return { status, firstAudioMs, unlock, reset, enqueue, pause, resume, markUnavailable };
}
