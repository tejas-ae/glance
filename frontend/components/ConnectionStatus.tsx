"use client";

import { useEffect, useState } from "react";

import {
  backendWebSocketUrl,
  ConnectionState,
  GlanceSocket,
} from "@/lib/ws";

export default function ConnectionStatus({ roomId }: { roomId: string }) {
  const [state, setState] = useState<ConnectionState>("connecting");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [retryMs, setRetryMs] = useState<number | null>(null);

  useEffect(() => {
    const socket = new GlanceSocket({
      url: backendWebSocketUrl(),
      roomId,
      onStatus: (nextState, nextRetryMs) => {
        setState(nextState);
        setRetryMs(nextRetryMs ?? null);
        if (nextState !== "connected") setLatencyMs(null);
      },
      onLatency: setLatencyMs,
    });
    socket.connect();
    return () => socket.disconnect();
  }, [roomId]);

  let label = "Connecting…";
  if (state === "connected") {
    label =
      latencyMs === null ? "Connected" : `Connected · ${Math.round(latencyMs)}ms`;
  } else if (state === "disconnected") {
    label = retryMs === null ? "Disconnected" : "Disconnected · retrying";
  }

  return (
    <span className={`status-pill status-${state}`} aria-live="polite">
      <i />
      {label}
    </span>
  );
}
