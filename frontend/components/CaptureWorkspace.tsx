"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import AudioRing from "./AudioRing";
import ScreenShare from "./ScreenShare";
import TapOverlay from "./TapOverlay";
import { captureSelection, type CaptureImages } from "@/lib/capture";
import { downloadPcmAsWav, PCM_SAMPLE_RATE_HZ, PcmRingBuffer } from "@/lib/pcm";
import type { BBox } from "@/lib/types";

const configuredWindow = Number(process.env.NEXT_PUBLIC_AUDIO_WINDOW_S ?? 60);
const AUDIO_WINDOW_SECONDS = Number.isFinite(configuredWindow) ? configuredWindow : 60;

type CaptureResources = {
  display: MediaStream | null;
  microphone: MediaStream | null;
  context: AudioContext | null;
};

export default function CaptureWorkspace() {
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
  }, []);

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

      try {
        const microphone = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });
        resources.current.microphone = microphone;
        await context.audioWorklet.addModule("/worklets/recorder.js");
        const source = context.createMediaStreamSource(microphone);
        const recorder = new AudioWorkletNode(context, "pcm-recorder", {
          processorOptions: { targetSampleRate: PCM_SAMPLE_RATE_HZ },
        });
        const silentOutput = context.createGain();
        silentOutput.gain.value = 0;
        recorder.port.onmessage = (event: MessageEvent<Int16Array>) => {
          ring.current.push(event.data);
        };
        source.connect(recorder).connect(silentOutput).connect(context.destination);
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
    const version = ++captureVersion.current;
    setBbox(selection);
    setError(null);
    try {
      if (!videoRef.current) return;
      const nextImages = await captureSelection(videoRef.current, selection);
      if (version === captureVersion.current) setImages(nextImages);
    } catch (captureError) {
      if (version === captureVersion.current) setError(message(captureError));
    }
  }

  function downloadAudio() {
    const samples = ring.current.snapshot();
    downloadPcmAsWav(samples, `glance-last-${Math.ceil(audioSeconds)}s.wav`);
  }

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
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Capture could not start.";
}
