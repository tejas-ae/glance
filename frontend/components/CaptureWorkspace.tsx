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
import { downloadPcmAsWav, pcmToBase64, PcmRingBuffer } from "@/lib/pcm";
import type { BBox } from "@/lib/types";
const configuredWindow = Number(process.env.NEXT_PUBLIC_AUDIO_WINDOW_S ?? 60);
const AUDIO_WINDOW_SECONDS = Number.isFinite(configuredWindow) ? configuredWindow : 60;
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
};

const CaptureWorkspace = forwardRef<CaptureWorkspaceHandle, CaptureWorkspaceProps>(
  function CaptureWorkspace({ explainStatus, onAudioUnlock, onCapture, onActiveChange }, ref) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const resources = useRef<CaptureResources>({
    display: null,
    microphone: null,
    context: null,
  });
  const ring = useRef(new PcmRingBuffer(AUDIO_WINDOW_SECONDS));
  const captureVersion = useRef(0);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  const [audioSeconds, setAudioSeconds] = useState(0);
  const [bbox, setBbox] = useState<BBox | null>(null);
  const [images, setImages] = useState<CaptureImages | null>(null);
  const [showBbox, setShowBbox] = useState(true);
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

  async function selectRegion(selection: BBox) {
    onAudioUnlock();
    const version = ++captureVersion.current;
    const startedAt = performance.now();
    setBbox(selection);
    setError(null);
    try {
      if (!videoRef.current) return;
      const nextImages = await captureSelection(videoRef.current, selection);
      if (version !== captureVersion.current) return;
      setImages(nextImages);
      onCapture(
        {
          bbox: selection,
          annotatedFrame: nextImages.annotatedFrame,
          crop: nextImages.crop,
          thumbnail: nextImages.thumbnail,
          audioPcm16: pcmToBase64(ring.current.snapshot()),
        },
        performance.now() - startedAt,
      );
    } catch (captureError) {
      if (version === captureVersion.current) setError(message(captureError));
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
          windowSeconds={AUDIO_WINDOW_SECONDS}
          active={active && Boolean(resources.current.microphone)}
        />
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
