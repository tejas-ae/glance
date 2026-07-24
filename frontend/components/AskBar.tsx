export default function AskBar() {
  return (
    <form className="ask-bar">
      <input
        aria-label="Question"
        placeholder="Ask about the selected region…"
        disabled
      />
      <button type="button" disabled>Ask</button>
    </form>
  );
}
