import type { ConnectionState } from "@/lib/ws";

type ConnectionStatusProps = {
  state: ConnectionState;
  latencyMs: number | null;
  retryMs: number | null;
};

export default function ConnectionStatus({
  state,
  latencyMs,
  retryMs,
}: ConnectionStatusProps) {
  let label = "Connecting…";
  if (state === "connected") {
    label =
      latencyMs === null ? "Connected" : `Connected · ${Math.round(latencyMs)}ms`;
  } else if (state === "disconnected") {
    label = retryMs === null ? "Disconnected" : "Disconnected · retrying";
  }

  return (
    <span className={`status-pill status-${state}`} aria-live="polite">
      <i />
      {label}
    </span>
  );
}
