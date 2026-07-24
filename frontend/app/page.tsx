"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");

  function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = roomCode.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (normalized) router.push(`/room/${encodeURIComponent(normalized)}`);
  }

  return (
    <main className="landing-shell">
      <nav className="landing-nav">
        <a className="brand" href="/" aria-label="Glance home">
          <span className="brand-mark">G</span>
          Glance
        </a>
        <span className="product-pill">Screen-aware meeting copilot</span>
      </nav>

      <section className="hero-grid">
        <div>
          <p className="eyebrow">Your meeting has visual context now</p>
          <h1>Point at it.<br />Glance explains it.</h1>
          <p className="hero-copy">
            Share your screen, select a region, and get an answer grounded in
            what your team said during the last minute.
          </p>

          <form className="room-form" onSubmit={joinRoom}>
            <label htmlFor="room-code">Enter a room code</label>
            <div className="room-controls">
              <input
                id="room-code"
                value={roomCode}
                onChange={(event) => setRoomCode(event.target.value)}
                placeholder="design-review"
                autoComplete="off"
                maxLength={40}
              />
              <button type="submit" disabled={!roomCode.trim()}>
                Enter room
              </button>
            </div>
          </form>
        </div>

        <div className="hero-visual" aria-label="Glance product preview">
          <div className="mock-window">
            <div className="mock-topbar">
              <span />
              <span />
              <span />
              <b>Quarterly architecture review</b>
            </div>
            <div className="mock-canvas">
              <div className="mock-node">Browser</div>
              <div className="mock-arrow">→</div>
              <div className="mock-node selected">Gemini</div>
              <div className="mock-arrow">→</div>
              <div className="mock-node">Answer</div>
              <div className="mock-caption">
                “This is the model boundary Priya mentioned.”
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
