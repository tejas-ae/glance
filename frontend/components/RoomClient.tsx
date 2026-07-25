"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AskBar from "./AskBar";
import AudioPlayer from "./AudioPlayer";
import CaptureWorkspace, {
  type CaptureWorkspaceHandle,
  type PreparedCapture,
} from "./CaptureWorkspace";
import ConnectionStatus from "./ConnectionStatus";
import ExplainPanel from "./ExplainPanel";
import LatencyHUD from "./LatencyHUD";
import type { GroundingMessage, ServerMessage } from "@/lib/types";
import {
  backendWebSocketUrl,
  type ConnectionState,
  GlanceSocket,
} from "@/lib/ws";
import { useAudioPlayback } from "@/lib/useAudioPlayback";
type ExplainStatus = "idle" | "loading" | "streaming" | "stopped" | "done" | "error";
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
  const captureWorkspaceRef = useRef<CaptureWorkspaceHandle>(null);
  const requestStartedAt = useRef(0);
  const sawFirstText = useRef(false);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [networkLatency, setNetworkLatency] = useState<number | null>(null);
  const [retryMs, setRetryMs] = useState<number | null>(null);
  const [view, setView] = useState<ExplainView>(initialView);
  const [question, setQuestion] = useState(
    "Explain this in the context of our recent conversation.",
  );
  const [language, setLanguage] = useState("English");
  const [hasSelected, setHasSelected] = useState(false);
  const [sharingActive, setSharingActive] = useState(false);
  const playback = useAudioPlayback();

  const handleActiveChange = useCallback((isActive: boolean) => {
    setSharingActive(isActive);
  }, []);

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
      } else if (message.type === "audio_delta") {
        playback.enqueue(message);
      } else if (message.type === "done") {
        if (!message.audio_available) playback.markUnavailable();
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
  }, [roomId, playback.enqueue, playback.markUnavailable]);

  function submit(capture: PreparedCapture, captureMs: number) {
    const requestId = `explain_${crypto.randomUUID()}`;
    const startedAt = performance.now();
    requestStartedAt.current = startedAt;
    playback.reset(startedAt);
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
      thumbnail_jpeg_base64: capture.thumbnail,
      audio_pcm16_base64: capture.audioPcm16,
      audio_sample_rate_hz: 16000,
      question: question.trim(),
      language,
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
    setHasSelected(true);
    submit(capturePayload, captureMs);
  }

  function resubmit() {
    // Re-captures a fresh frame/crop/audio snapshot for the same region
    // instead of resending the stale one from the last tap.
    captureWorkspaceRef.current?.recapture();
  }

  function stop() {
    socketRef.current?.cancelActive();
    playback.reset(performance.now());
    setView((current) => ({ ...current, status: "stopped" }));
  }

  return (
    <main className="room-shell">
      <header className="room-header">
        <a className="brand" href="/" aria-label="Back to Glance home">
          <span className="brand-mark">G</span>Glance
        </a>
        <div className="room-meta">
          <span>Room</span><strong>{roomId}</strong>
          <a className="recap-link" href={`/room/${encodeURIComponent(roomId)}/recap`}>
            Recap
          </a>
          <ConnectionStatus
            state={connection}
            latencyMs={networkLatency}
            retryMs={retryMs}
          />
        </div>
      </header>

      <section className="room-grid">
        <CaptureWorkspace
          ref={captureWorkspaceRef}
          explainStatus={view.status}
          onAudioUnlock={playback.unlock}
          onCapture={capture}
          onActiveChange={handleActiveChange}
        />
        <div className="pane explain-pane">
          <ExplainPanel
            status={view.status}
            text={view.text}
            grounding={view.grounding}
            error={view.error}
            onStop={stop}
          />
          <LatencyHUD
            status={view.status}
            captureMs={view.captureMs}
            firstTextMs={view.firstTextMs}
            firstAudioMs={playback.firstAudioMs}
            completeMs={view.completeMs}
          />
          <AskBar
            question={question}
            language={language}
            enabled={hasSelected && sharingActive && connection === "connected"}
            onQuestionChange={setQuestion}
            onLanguageChange={setLanguage}
            onSubmit={resubmit}
          />
          <AudioPlayer status={playback.status} />
        </div>
      </section>
    </main>
  );
}
