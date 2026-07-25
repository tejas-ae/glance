"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import AudioRing from "./AudioRing";
import ScreenShare from "./ScreenShare";
import TapOverlay from "./TapOverlay";
import { captureSelection, type CaptureImages } from "@/lib/capture";
import { connectMicrophone } from "@/lib/microphone";
import {
  downloadPcmAsWav,
  pcmToBase64,
  PcmRingBuffer,
  trimToLastSeconds,
} from "@/lib/pcm";
import type { BBox } from "@/lib/types";

// The largest lookback window a user can pick at capture time. The ring
// buffer is sized to this, not to any single duration option below.
const configuredMaxWindow = Number(process.env.NEXT_PUBLIC_AUDIO_WINDOW_S ?? 120);
const MAX_AUDIO_WINDOW_SECONDS = Number.isFinite(configuredMaxWindow) ? configuredMaxWindow : 120;
const DEFAULT_DURATION_SECONDS = 60;
const DURATION_OPTIONS_SECONDS = [30, 60, 120].filter(
  (seconds) => seconds <= MAX_AUDIO_WINDOW_SECONDS,
);

type CaptureResources = {
  display: MediaStream | null;
  microphone: MediaStream | null;
  context: AudioContext | null;
};
export type PreparedCapture = {
  bbox: BBox;
  annotatedFrame: string;
  crop: string;
  thumbnail: string;
  audioPcm16: string;
};
type CaptureWorkspaceProps = {
  explainStatus: "idle" | "loading" | "streaming" | "stopped" | "done" | "error";
  onAudioUnlock: () => void;
  onCapture: (capture: PreparedCapture, captureMs: number) => void;
  onActiveChange?: (active: boolean) => void;
};

export type CaptureWorkspaceHandle = {
  /** Re-captures a fresh frame/crop/audio snapshot for the last selected
   * region and submits it, without requiring the user to drag again. */
  recapture: () => void;
  /** Re-sends the same frame/crop from the last tap with a different
   * length of audio, trimmed from the snapshot frozen at tap time (not a
   * fresh read of the live buffer, so the lookback window still ends at
   * the original tap rather than sliding later). */
  changeDuration: (seconds: number) => void;
};

const CaptureWorkspace = forwardRef<CaptureWorkspaceHandle, CaptureWorkspaceProps>(
  function CaptureWorkspace({ explainStatus, onAudioUnlock, onCapture, onActiveChange }, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const resources = useRef<CaptureResources>({
    display: null,
    microphone: null,
    context: null,
  });
  const ring = useRef(new PcmRingBuffer(MAX_AUDIO_WINDOW_SECONDS));
  const frozenAudio = useRef<Int16Array | null>(null);
  const captureVersion = useRef(0);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  const [audioSeconds, setAudioSeconds] = useState(0);
  const [bbox, setBbox] = useState<BBox | null>(null);
  const [images, setImages] = useState<CaptureImages | null>(null);
  const [showBbox, setShowBbox] = useState(true);
  const [durationSeconds, setDurationSeconds] = useState(DEFAULT_DURATION_SECONDS);
  const [error, setError] = useState<string | null>(null);

  const stopCapture = useCallback(() => {
    captureVersion.current += 1;
    resources.current.display?.getTracks().forEach((track) => track.stop());
    resources.current.microphone?.getTracks().forEach((track) => track.stop());
    void resources.current.context?.close();
    resources.current = { display: null, microphone: null, context: null };
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setBbox(null);
    setImages(null);
    frozenAudio.current = null;
    onActiveChange?.(false);
  }, [onActiveChange]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setAudioSeconds(ring.current.durationSeconds),
      200,
    );
    return () => {
      window.clearInterval(timer);
      stopCapture();
    };
  }, [stopCapture]);

  async function startCapture() {
    setStarting(true);
    setError(null);
    try {
      const context = new AudioContext();
      resources.current.context = context;
      await context.resume();
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 15 },
        audio: false,
      });
      resources.current.display = display;
      if (videoRef.current) videoRef.current.srcObject = display;
      display.getVideoTracks()[0].addEventListener("ended", stopCapture, { once: true });
      setActive(true);
      onActiveChange?.(true);

      try {
        const microphone = await connectMicrophone(context, (chunk) => {
          ring.current.push(chunk);
        });
        resources.current.microphone = microphone;
      } catch (audioError) {
        setError(`Screen sharing is live, but microphone capture failed: ${message(audioError)}`);
      }
    } catch (captureError) {
      stopCapture();
      setError(message(captureError));
    } finally {
      setStarting(false);
    }
  }

  function sendCapture(
    selection: BBox,
    currentImages: CaptureImages,
    seconds: number,
    captureMs: number,
  ) {
    const trimmed = frozenAudio.current
      ? trimToLastSeconds(frozenAudio.current, seconds)
      : new Int16Array(0);
    onCapture(
      {
        bbox: selection,
        annotatedFrame: currentImages.annotatedFrame,
        crop: currentImages.crop,
        thumbnail: currentImages.thumbnail,
        audioPcm16: pcmToBase64(trimmed),
      },
      captureMs,
    );
  }

  async function selectRegion(selection: BBox) {
    onAudioUnlock();
    const version = ++captureVersion.current;
    const startedAt = performance.now();
    // Freeze the audio snapshot immediately, before the (async) frame
    // capture below, so the lookback window anchors to this exact moment
    // regardless of how long image capture or a later duration change takes.
    frozenAudio.current = ring.current.snapshot();
    setBbox(selection);
    setError(null);
    try {
      if (!videoRef.current) return;
      const nextImages = await captureSelection(videoRef.current, selection);
      if (version !== captureVersion.current) return;
      setImages(nextImages);
      sendCapture(selection, nextImages, durationSeconds, performance.now() - startedAt);
    } catch (captureError) {
      if (version === captureVersion.current) setError(message(captureError));
    }
  }

  function changeDuration(seconds: number) {
    setDurationSeconds(seconds);
    if (bbox && images && frozenAudio.current) {
      const startedAt = performance.now();
      sendCapture(bbox, images, seconds, performance.now() - startedAt);
    }
  }

  function downloadAudio() {
    const samples = ring.current.snapshot();
    downloadPcmAsWav(samples, `glance-last-${Math.ceil(audioSeconds)}s.wav`);
  }

  useImperativeHandle(ref, () => ({
    recapture: () => {
      if (bbox) void selectRegion(bbox);
    },
    changeDuration,
  }));

  return (
    <>
      <div className="pane screen-pane">
        <div className="pane-heading">
          <div>
            <p className="eyebrow">Shared screen</p>
            <h1>Visual context</h1>
          </div>
          <button
            className="primary-button"
            type="button"
            disabled={starting}
            onClick={active ? stopCapture : startCapture}
          >
            {starting ? "Starting…" : active ? "Stop sharing" : "Share screen"}
          </button>
        </div>
        <ScreenShare
          active={active}
          videoRef={videoRef}
          aspectRatio={aspectRatio}
          bbox={bbox}
          showBbox={showBbox}
          focused={explainStatus === "loading" || explainStatus === "streaming"}
          onVideoReady={() => {
            const video = videoRef.current;
            if (video?.videoWidth && video.videoHeight) {
              setAspectRatio(video.videoWidth / video.videoHeight);
            }
          }}
          onSelection={selectRegion}
        />
        <AudioRing
          seconds={audioSeconds}
          windowSeconds={MAX_AUDIO_WINDOW_SECONDS}
          active={active && Boolean(resources.current.microphone)}
        />
        <div className="duration-picker">
          <span>Explain using last</span>
          <div className="duration-options">
            {DURATION_OPTIONS_SECONDS.map((seconds) => (
              <button
                key={seconds}
                type="button"
                className={seconds === durationSeconds ? "is-selected" : ""}
                onClick={() => changeDuration(seconds)}
              >
                {formatDuration(seconds)}
              </button>
            ))}
          </div>
        </div>
        {error && <p className="capture-error" role="alert">{error}</p>}
      </div>

      <div className="pane selection-pane">
        <div className="pane-heading compact">
          <div>
            <p className="eyebrow">Capture debug</p>
            <h2>Selection output</h2>
          </div>
        </div>
        <TapOverlay
          bbox={bbox}
          annotatedFrame={images?.annotatedFrame ?? null}
          crop={images?.crop ?? null}
          showBbox={showBbox}
          canDownloadAudio={audioSeconds > 0}
          onShowBboxChange={setShowBbox}
          onDownloadAudio={downloadAudio}
        />
      </div>
    </>
  );
  },
);

export default CaptureWorkspace;

function message(error: unknown) {
  return error instanceof Error ? error.message : "Capture could not start.";
}

function formatDuration(seconds: number) {
  return seconds < 60 ? `${seconds}s` : `${Math.round(seconds / 60)}min`;
}
