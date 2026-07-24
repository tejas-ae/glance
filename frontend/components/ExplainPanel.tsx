export default function ExplainPanel() {
  return (
    <section className="explain-panel">
      <header>
        <div>
          <p className="eyebrow">In context</p>
          <h2>Explanation</h2>
        </div>
        <span className="empty-badge">Waiting</span>
      </header>
      <div className="explain-empty">
        <div>
          <span aria-hidden="true">◎</span>
          <p>Select something on your shared screen to explain it here.</p>
        </div>
      </div>
    </section>
  );
}
