import type { BBox } from "@/lib/types";

type TapOverlayProps = {
  bbox: BBox | null;
  annotatedFrame: string | null;
  crop: string | null;
  showBbox: boolean;
  canDownloadAudio: boolean;
  onShowBboxChange: (value: boolean) => void;
  onDownloadAudio: () => void;
};

export default function TapOverlay({
  bbox,
  annotatedFrame,
  crop,
  showBbox,
  canDownloadAudio,
  onShowBboxChange,
  onDownloadAudio,
}: TapOverlayProps) {
  return (
    <div className="capture-debug">
      <label className="debug-toggle">
        <input
          type="checkbox"
          checked={showBbox}
          onChange={(event) => onShowBboxChange(event.target.checked)}
        />
        Draw captured box on video
      </label>

      <button
        className="debug-button"
        type="button"
        disabled={!canDownloadAudio}
        onClick={onDownloadAudio}
      >
        Download buffered audio (.wav)
      </button>

      <div className="bbox-readout">
        <span>Normalized bbox</span>
        <code>{bbox ? formatBbox(bbox) : "Drag on the shared screen"}</code>
      </div>

      <Preview label="Annotated frame" source={annotatedFrame} />
      <Preview label="Padded crop" source={crop} />
    </div>
  );
}

function Preview({ label, source }: { label: string; source: string | null }) {
  return (
    <figure className="capture-preview">
      <figcaption>{label}</figcaption>
      {source ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`data:image/jpeg;base64,${source}`} alt={label} />
      ) : (
        <div><span>Waiting for a selection</span></div>
      )}
    </figure>
  );
}

function formatBbox(bbox: BBox) {
  return [bbox.x, bbox.y, bbox.width, bbox.height]
    .map((value) => value.toFixed(3))
    .join(", ");
}
