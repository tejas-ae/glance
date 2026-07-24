type AudioRingProps = {
  seconds: number;
  windowSeconds: number;
  active: boolean;
};

export default function AudioRing({ seconds, windowSeconds, active }: AudioRingProps) {
  const displayedSeconds = Math.min(windowSeconds, seconds);
  const fill = (displayedSeconds / windowSeconds) * 100;

  return (
    <div
      className="audio-ring"
      aria-label={`Audio buffer contains ${displayedSeconds.toFixed(1)} seconds`}
    >
      <small>
        <i className={active ? "audio-live" : ""} aria-hidden="true" />
        Audio buffer
      </small>
      <div className="audio-ring-track">
        <div className="audio-ring-fill" style={{ width: `${fill}%` }} />
      </div>
      <small>{displayedSeconds.toFixed(1)} / {windowSeconds}s</small>
    </div>
  );
}
