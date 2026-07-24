import AskBar from "@/components/AskBar";
import AudioPlayer from "@/components/AudioPlayer";
import AudioRing from "@/components/AudioRing";
import ConnectionStatus from "@/components/ConnectionStatus";
import ExplainPanel from "@/components/ExplainPanel";
import LatencyHUD from "@/components/LatencyHUD";
import ScreenShare from "@/components/ScreenShare";
import TapOverlay from "@/components/TapOverlay";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;

  return (
    <main className="room-shell">
      <header className="room-header">
        <a className="brand" href="/" aria-label="Back to Glance home">
          <span className="brand-mark">G</span>
          Glance
        </a>
        <div className="room-meta">
          <span>Room</span>
          <strong>{decodeURIComponent(roomId)}</strong>
          <ConnectionStatus roomId={decodeURIComponent(roomId)} />
        </div>
      </header>

      <section className="room-grid">
        <div className="pane screen-pane">
          <div className="pane-heading">
            <div>
              <p className="eyebrow">Shared screen</p>
              <h1>Visual context</h1>
            </div>
            <button className="primary-button" disabled>Share screen</button>
          </div>
          <ScreenShare />
          <AudioRing />
        </div>

        <div className="pane selection-pane">
          <div className="pane-heading compact">
            <div>
              <p className="eyebrow">Selection</p>
              <h2>Tap overlay</h2>
            </div>
          </div>
          <TapOverlay />
          <LatencyHUD />
        </div>

        <div className="pane explain-pane">
          <ExplainPanel />
          <AskBar />
          <AudioPlayer />
        </div>
      </section>
    </main>
  );
}
