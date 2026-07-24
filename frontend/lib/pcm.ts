export const PCM_SAMPLE_RATE_HZ = 16_000;

export class PcmRingBuffer {
  private readonly samples: Int16Array;
  private writeIndex = 0;
  private count = 0;

  constructor(seconds: number) {
    this.samples = new Int16Array(PCM_SAMPLE_RATE_HZ * seconds);
  }

  push(chunk: Int16Array) {
    if (chunk.length >= this.samples.length) {
      this.samples.set(chunk.subarray(chunk.length - this.samples.length));
      this.writeIndex = 0;
      this.count = this.samples.length;
      return;
    }

    const firstLength = Math.min(chunk.length, this.samples.length - this.writeIndex);
    this.samples.set(chunk.subarray(0, firstLength), this.writeIndex);
    this.samples.set(chunk.subarray(firstLength), 0);
    this.writeIndex = (this.writeIndex + chunk.length) % this.samples.length;
    this.count = Math.min(this.count + chunk.length, this.samples.length);
  }

  snapshot() {
    const result = new Int16Array(this.count);
    const start = (this.writeIndex - this.count + this.samples.length) % this.samples.length;
    const firstLength = Math.min(this.count, this.samples.length - start);
    result.set(this.samples.subarray(start, start + firstLength));
    result.set(this.samples.subarray(0, this.count - firstLength), firstLength);
    return result;
  }

  get durationSeconds() {
    return this.count / PCM_SAMPLE_RATE_HZ;
  }
}

export function pcmToBase64(samples: Int16Array) {
  const bytes = new Uint8Array(samples.buffer, samples.byteOffset, samples.byteLength);
  let binary = "";
  const chunkSize = 32_768;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export function downloadPcmAsWav(samples: Int16Array, filename: string) {
  const buffer = new ArrayBuffer(44 + samples.byteLength);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.byteLength, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, PCM_SAMPLE_RATE_HZ, true);
  view.setUint32(28, PCM_SAMPLE_RATE_HZ * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, samples.byteLength, true);

  for (let index = 0; index < samples.length; index += 1) {
    view.setInt16(44 + index * 2, samples[index], true);
  }

  const url = URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}
