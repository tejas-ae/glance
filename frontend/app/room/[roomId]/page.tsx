import AskBar from "@/components/AskBar";
import AudioPlayer from "@/components/AudioPlayer";
import CaptureWorkspace from "@/components/CaptureWorkspace";
import ConnectionStatus from "@/components/ConnectionStatus";
import ExplainPanel from "@/components/ExplainPanel";

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
        <CaptureWorkspace />

        <div className="pane explain-pane">
          <ExplainPanel />
          <AskBar />
          <AudioPlayer />
        </div>
      </section>
    </main>
  );
}
