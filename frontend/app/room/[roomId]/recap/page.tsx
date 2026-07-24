type Artifact = {
  id: string;
  thumbnail_url: string;
  question: string;
  answer: string;
  grounding_quote: string;
  timestamp: string | null;
  latency_ms: number;
};

export default async function RecapPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId: encodedRoomId } = await params;
  const roomId = decodeURIComponent(encodedRoomId);
  const result = await loadRecap(roomId);

  return (
    <main className="recap-shell">
      <header className="recap-header">
        <a className="brand" href="/"><span className="brand-mark">G</span>Glance</a>
        <nav>
          <span className="product-pill">Room {roomId}</span>
          <a className="recap-back" href={`/room/${encodeURIComponent(roomId)}`}>
            Back to room
          </a>
        </nav>
      </header>
      <section className="recap-intro">
        <p className="eyebrow">Session artifact</p>
        <h1>What you looked at</h1>
        <p>Every selection, explanation, and grounded quote from this room.</p>
      </section>
      {result.error ? (
        <div className="recap-empty" role="alert">{result.error}</div>
      ) : result.artifacts.length === 0 ? (
        <div className="recap-empty">
          Select something in the room and its explanation will appear here.
        </div>
      ) : (
        <section className="recap-grid">
          {result.artifacts.map((artifact) => (
            <article className="recap-card" key={artifact.id}>
              <img src={artifact.thumbnail_url} alt="Selected screen region" />
              <div className="recap-card-body">
                <time>{formatTime(artifact.timestamp)}</time>
                <h2>{artifact.question}</h2>
                <p className="recap-answer">{artifact.answer}</p>
                {artifact.grounding_quote && (
                  <blockquote className="recap-quote">
                    “{artifact.grounding_quote}”
                  </blockquote>
                )}
                <small className="recap-latency">
                  Explained in {artifact.latency_ms}ms
                </small>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

async function loadRecap(roomId: string) {
  const backend = process.env.NEXT_PUBLIC_BACKEND_HTTP_URL ?? "http://localhost:8000";
  try {
    const response = await fetch(
      `${backend}/rooms/${encodeURIComponent(roomId)}/recap`,
      { cache: "no-store" },
    );
    if (!response.ok) throw new Error(`Recap service returned ${response.status}`);
    return await response.json() as {
      room_id: string;
      artifacts: Artifact[];
      error?: never;
    };
  } catch {
    return {
      room_id: roomId,
      artifacts: [] as Artifact[],
      error: "The recap is temporarily unavailable. Try again in a moment.",
    };
  }
}

function formatTime(timestamp: string | null) {
  if (!timestamp) return "Just now";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}
