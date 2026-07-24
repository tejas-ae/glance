import type { AudioDeltaMessage } from "@/lib/types";

type QueueCallbacks = {
  onFirstPlayback: () => void;
  onPlayingChange: (playing: boolean) => void;
};

export class PcmAudioQueue {
  private context: AudioContext | null = null;
  private pending = new Map<number, AudioDeltaMessage>();
  private sources = new Set<AudioBufferSourceNode>();
  private nextSequence = 0;
  private nextStartTime = 0;
  private generation = 0;
  private started = false;

  constructor(private readonly callbacks: QueueCallbacks) {}

  unlock(): void {
    if (!this.context) this.context = new AudioContext();
    void this.context.resume();
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
    this.callbacks.onPlayingChange(false);
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
      if (generation === this.generation && this.sources.size === 0) {
        this.callbacks.onPlayingChange(false);
      }
    };
    this.sources.add(source);
    source.start(startAt);
    if (!this.started) {
      this.started = true;
      this.callbacks.onFirstPlayback();
    }
    this.callbacks.onPlayingChange(true);
  }
}

function decodePcm(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
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
