"use client";

import { useEffect, useRef, useState } from "react";

import AskBar from "./AskBar";
import AudioPlayer from "./AudioPlayer";
import CaptureWorkspace, { type PreparedCapture } from "./CaptureWorkspace";
import ConnectionStatus from "./ConnectionStatus";
import ExplainPanel from "./ExplainPanel";
import LatencyHUD from "./LatencyHUD";
import type { GroundingMessage, ServerMessage } from "@/lib/types";
import {
  backendWebSocketUrl,
  type ConnectionState,
  GlanceSocket,
} from "@/lib/ws";

type ExplainStatus = "idle" | "loading" | "streaming" | "done" | "error";
type ExplainView = {
  status: ExplainStatus;
  text: string;
  grounding: GroundingMessage | null;
  error: string | null;
  captureMs: number | null;
  firstTextMs: number | null;
  completeMs: number | null;
};

const initialView: ExplainView = {
  status: "idle",
  text: "",
  grounding: null,
  error: null,
  captureMs: null,
  firstTextMs: null,
  completeMs: null,
};

export default function RoomClient({ roomId }: { roomId: string }) {
  const socketRef = useRef<GlanceSocket | null>(null);
  const requestStartedAt = useRef(0);
  const sawFirstText = useRef(false);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [networkLatency, setNetworkLatency] = useState<number | null>(null);
  const [retryMs, setRetryMs] = useState<number | null>(null);
  const [view, setView] = useState<ExplainView>(initialView);
  const [question, setQuestion] = useState(
    "Explain this in the context of our recent conversation.",
  );
  const [lastCapture, setLastCapture] = useState<PreparedCapture | null>(null);
  const [lastCaptureMs, setLastCaptureMs] = useState(0);

  useEffect(() => {
    function receive(message: ServerMessage) {
      if (message.type === "text_delta") {
        const firstTextMs = sawFirstText.current
          ? null
          : performance.now() - requestStartedAt.current;
        sawFirstText.current = true;
        setView((current) => ({
          ...current,
          status: "streaming",
          text: current.text + message.delta,
          firstTextMs: current.firstTextMs ?? firstTextMs,
        }));
      } else if (message.type === "grounding") {
        setView((current) => ({ ...current, grounding: message }));
      } else if (message.type === "done") {
        setView((current) => ({
          ...current,
          status: "done",
          completeMs: performance.now() - requestStartedAt.current,
        }));
      } else if (message.type === "error") {
        setView((current) => ({
          ...current,
          status: "error",
          error: message.message,
          completeMs: performance.now() - requestStartedAt.current,
        }));
      }
    }

    const socket = new GlanceSocket({
      url: backendWebSocketUrl(),
      roomId,
      onStatus: (state, nextRetryMs) => {
        setConnection(state);
        setRetryMs(nextRetryMs ?? null);
        if (state !== "connected") setNetworkLatency(null);
      },
      onLatency: setNetworkLatency,
      onMessage: receive,
    });
    socketRef.current = socket;
    socket.connect();
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId]);

  function submit(capture: PreparedCapture, captureMs: number) {
    const requestId = `explain_${crypto.randomUUID()}`;
    requestStartedAt.current = performance.now();
    sawFirstText.current = false;
    setView({
      ...initialView,
      status: "loading",
      captureMs,
    });
    const sent = socketRef.current?.send({
      type: "explain_request",
      request_id: requestId,
      room_id: roomId,
      bbox: capture.bbox,
      annotated_frame_jpeg_base64: capture.annotatedFrame,
      crop_jpeg_base64: capture.crop,
      audio_pcm16_base64: capture.audioPcm16,
      audio_sample_rate_hz: 16000,
      question: question.trim(),
      language: "English",
    });
    if (!sent) {
      setView((current) => ({
        ...current,
        status: "error",
        error: "The room is disconnected. Glance will reconnect automatically.",
      }));
    }
  }

  function capture(capturePayload: PreparedCapture, captureMs: number) {
    setLastCapture(capturePayload);
    setLastCaptureMs(captureMs);
    submit(capturePayload, captureMs);
  }

  return (
    <main className="room-shell">
      <header className="room-header">
        <a className="brand" href="/" aria-label="Back to Glance home">
          <span className="brand-mark">G</span>Glance
        </a>
        <div className="room-meta">
          <span>Room</span><strong>{roomId}</strong>
          <ConnectionStatus
            state={connection}
            latencyMs={networkLatency}
            retryMs={retryMs}
          />
        </div>
      </header>

      <section className="room-grid">
        <CaptureWorkspace explainStatus={view.status} onCapture={capture} />
        <div className="pane explain-pane">
          <ExplainPanel
            status={view.status}
            text={view.text}
            grounding={view.grounding}
            error={view.error}
          />
          <LatencyHUD
            status={view.status}
            captureMs={view.captureMs}
            firstTextMs={view.firstTextMs}
            completeMs={view.completeMs}
          />
          <AskBar
            question={question}
            enabled={Boolean(lastCapture) && connection === "connected"}
            onQuestionChange={setQuestion}
            onSubmit={() => lastCapture && submit(lastCapture, lastCaptureMs)}
          />
          <AudioPlayer />
        </div>
      </section>
    </main>
  );
}
