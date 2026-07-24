import type { GroundingMessage } from "@/lib/types";

type ExplainPanelProps = {
  status: "idle" | "loading" | "streaming" | "done" | "error";
  text: string;
  grounding: GroundingMessage | null;
  error: string | null;
};

export default function ExplainPanel({
  status,
  text,
  grounding,
  error,
}: ExplainPanelProps) {
  const label = {
    idle: "Waiting",
    loading: "Looking + listening",
    streaming: "Explaining",
    done: "Grounded",
    error: "Error",
  }[status];

  return (
    <section className="explain-panel" aria-live="polite">
      <header>
        <div>
          <p className="eyebrow">In context</p>
          <h2>Explanation</h2>
        </div>
        <span className={`empty-badge explain-badge-${status}`}>{label}</span>
      </header>

      {status === "idle" && (
        <div className="explain-empty">
          <div>
            <span aria-hidden="true">◎</span>
            <p>Select something on your shared screen to explain it here.</p>
          </div>
        </div>
      )}
      {status === "loading" && (
        <div className="explain-loading">
          <i /><i /><i /><p>Reading the region with recent conversation…</p>
        </div>
      )}
      {(status === "streaming" || status === "done") && (
        <div className="explain-result">
          <p>{text}<span className={status === "streaming" ? "stream-caret" : ""} /></p>
          {grounding && (
            <blockquote>
              <span>Grounded in your conversation · {Math.abs(grounding.grounding_offset_seconds ?? 0)}s ago</span>
              “{grounding.grounding_quote}”
              <small>{grounding.region_label} · {Math.round(grounding.confidence * 100)}% confidence</small>
            </blockquote>
          )}
        </div>
      )}
      {status === "error" && (
        <div className="explain-error">
          <strong>Explanation failed</strong>
          <p>{error}</p>
          <small>Drag the region again to retry.</small>
        </div>
      )}
    </section>
  );
}
