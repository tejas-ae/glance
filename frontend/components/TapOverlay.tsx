export default function TapOverlay() {
  return (
    <div className="tap-placeholder">
      <div>
        <div className="tap-preview" aria-hidden="true" />
        <strong>Drag to select</strong>
        <p>Your selected screen region and capture previews will appear here.</p>
      </div>
    </div>
  );
}
