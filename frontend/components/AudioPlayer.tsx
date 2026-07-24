import type { AudioStatus } from "@/lib/useAudioPlayback";

export default function AudioPlayer({ status }: { status: AudioStatus }) {
  return (
    <div className={`audio-player audio-${status}`} role="status">
      <span aria-hidden="true">{status === "playing" ? "◖))" : "◖"}</span>
      {label(status)}
    </div>
  );
}

function label(status: AudioStatus) {
  if (status === "playing") return "Playing explanation";
  if (status === "ready") return "Speech ready";
  if (status === "unavailable") return "Speech unavailable — text still works";
  return "Speech unlocks when you select a region";
}
