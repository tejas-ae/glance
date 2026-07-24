"use client";

import type { FormEvent } from "react";

type AskBarProps = {
  question: string;
  language: string;
  enabled: boolean;
  onQuestionChange: (question: string) => void;
  onLanguageChange: (language: string) => void;
  onSubmit: () => void;
};

const LANGUAGES = [
  "English",
  "Spanish",
  "French",
  "German",
  "Italian",
  "Portuguese",
  "Hindi",
  "Japanese",
  "Korean",
  "Mandarin Chinese",
];

export default function AskBar({
  question,
  language,
  enabled,
  onQuestionChange,
  onLanguageChange,
  onSubmit,
}: AskBarProps) {
  function submit(event: FormEvent) {
    event.preventDefault();
    if (enabled && question.trim()) onSubmit();
  }

  return (
    <form className="ask-bar" onSubmit={submit}>
      <select
        aria-label="Explanation language"
        value={language}
        onChange={(event) => onLanguageChange(event.target.value)}
      >
        {LANGUAGES.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
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
