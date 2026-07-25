import type { AudioStatus } from "@/lib/useAudioPlayback";

export default function AudioPlayer({
  status,
  onPause,
  onResume,
}: {
  status: AudioStatus;
  onPause: () => void;
  onResume: () => void;
}) {
  const canToggle = status === "playing" || status === "paused";

  return (
    <button
      type="button"
      className={`audio-player audio-${status}`}
      onClick={status === "playing" ? onPause : onResume}
      disabled={!canToggle}
    >
      <span aria-hidden="true">{icon(status)}</span>
      {label(status)}
    </button>
  );
}

function icon(status: AudioStatus) {
  if (status === "playing") return "❚❚";
  if (status === "paused") return "▶";
  return "◖";
}

function label(status: AudioStatus) {
  if (status === "playing") return "Playing — tap to pause";
  if (status === "paused") return "Paused — tap to resume";
  if (status === "ready") return "Speech ready";
  if (status === "unavailable") return "Speech unavailable — text still works";
  return "Speech unlocks when you select a region";
}
