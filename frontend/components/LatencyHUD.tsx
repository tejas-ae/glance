type LatencyHUDProps = {
  status: string;
  captureMs: number | null;
  firstTextMs: number | null;
  completeMs: number | null;
};

export default function LatencyHUD({
  status,
  captureMs,
  firstTextMs,
  completeMs,
}: LatencyHUDProps) {
  return (
    <aside className="latency-hud">
      <header><span>Latency HUD</span><span>{statusLabel(status)}</span></header>
      <dl>
        <dt>Capture</dt><dd>{format(captureMs)}</dd>
        <dt>First text</dt><dd>{format(firstTextMs)}</dd>
        <dt>Complete</dt><dd>{format(completeMs)}</dd>
      </dl>
    </aside>
  );
}

function format(value: number | null) {
  return value === null ? "—" : `${Math.round(value)}ms`;
}

function statusLabel(status: string) {
  if (status === "loading") return "Thinking";
  if (status === "streaming") return "Streaming";
  if (status === "done") return "Complete";
  if (status === "error") return "Failed";
  return "Idle";
}
