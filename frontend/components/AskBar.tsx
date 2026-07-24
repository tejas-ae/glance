"use client";

import type { FormEvent } from "react";

type AskBarProps = {
  question: string;
  enabled: boolean;
  onQuestionChange: (question: string) => void;
  onSubmit: () => void;
};

export default function AskBar({
  question,
  enabled,
  onQuestionChange,
  onSubmit,
}: AskBarProps) {
  function submit(event: FormEvent) {
    event.preventDefault();
    if (enabled && question.trim()) onSubmit();
  }

  return (
    <form className="ask-bar" onSubmit={submit}>
      <input
        aria-label="Question"
        placeholder="Ask about the selected region…"
        value={question}
        onChange={(event) => onQuestionChange(event.target.value)}
      />
      <button type="submit" disabled={!enabled || !question.trim()}>Ask</button>
    </form>
  );
}
