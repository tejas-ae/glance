import type { AudioDeltaMessage } from "@/lib/types";

export type QueueStatus = "idle" | "playing" | "paused";

type QueueCallbacks = {
  onFirstPlayback: () => void;
  onStatusChange: (status: QueueStatus) => void;
};

export class PcmAudioQueue {
  private context: AudioContext | null = null;
  private pending = new Map<number, AudioDeltaMessage>();
  private sources = new Set<AudioBufferSourceNode>();
  private nextSequence = 0;
  private nextStartTime = 0;
  private generation = 0;
  private started = false;
  private hasContent = false;
  private paused = false;

  constructor(private readonly callbacks: QueueCallbacks) {}

  unlock(): void {
    if (!this.context) this.context = new AudioContext();
    void this.context.resume();
  }

  /** Freezes playback in place (Web Audio's own clock stops advancing, so
   * every scheduled source stays exactly where it was). */
  pause(): void {
    if (!this.context || !this.hasContent || this.paused) return;
    this.paused = true;
    void this.context.suspend();
    this.callbacks.onStatusChange("paused");
  }

  /** Continues playback from exactly where `pause()` left it. */
  resumePlayback(): void {
    if (!this.context || !this.hasContent || !this.paused) return;
    this.paused = false;
    void this.context.resume();
    this.callbacks.onStatusChange(this.sources.size > 0 ? "playing" : "idle");
  }

  reset(): void {
    this.generation += 1;
    this.sources.forEach((source) => {
      try {
        source.stop();
      } catch {
        // The source may already have ended.
      }
    });
    this.sources.clear();
    this.pending.clear();
    this.nextSequence = 0;
    this.nextStartTime = this.context?.currentTime ?? 0;
    this.started = false;
    this.hasContent = false;
    this.paused = false;
    void this.context?.resume();
    this.callbacks.onStatusChange("idle");
  }

  enqueue(message: AudioDeltaMessage): void {
    if (!this.context || message.seq < this.nextSequence) return;
    this.pending.set(message.seq, message);
    this.flush();
  }

  destroy(): void {
    this.reset();
    void this.context?.close();
    this.context = null;
  }

  private flush(): void {
    const context = this.context;
    if (!context) return;
    let message = this.pending.get(this.nextSequence);
    while (message) {
      this.pending.delete(this.nextSequence);
      this.schedule(context, message);
      this.nextSequence += 1;
      message = this.pending.get(this.nextSequence);
    }
  }

  private schedule(
    context: AudioContext,
    message: AudioDeltaMessage,
  ): void {
    const samples = decodePcm(message.audio_pcm16_base64);
    const buffer = context.createBuffer(
      1,
      samples.length,
      message.audio_sample_rate_hz,
    );
    buffer.copyToChannel(samples, 0);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    const startAt = Math.max(context.currentTime + 0.02, this.nextStartTime);
    this.nextStartTime = startAt + buffer.duration;
    const generation = this.generation;
    source.onended = () => {
      this.sources.delete(source);
      if (generation === this.generation && this.sources.size === 0 && !this.paused) {
        this.callbacks.onStatusChange("idle");
      }
    };
    this.sources.add(source);
    source.start(startAt);
    this.hasContent = true;
    if (!this.started) {
      this.started = true;
      this.callbacks.onFirstPlayback();
    }
    if (!this.paused) this.callbacks.onStatusChange("playing");
  }
}

function decodePcm(base64: string): Float32Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  const view = new DataView(bytes.buffer);
  const samples = new Float32Array(Math.floor(bytes.length / 2));
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = view.getInt16(index * 2, true) / 32768;
  }
  return samples;
}
