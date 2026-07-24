export default function AudioRing() {
  return (
    <div className="audio-ring" aria-label="Audio buffer is empty">
      <small>Audio buffer</small>
      <div className="audio-ring-track">
        <div className="audio-ring-fill" />
      </div>
      <small>0 / 60s</small>
    </div>
  );
}
