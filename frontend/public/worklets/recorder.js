class PcmRecorderProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.targetRate = options.processorOptions?.targetSampleRate ?? 16000;
    this.rateAccumulator = 0;
    this.sampleAccumulator = 0;
    this.sampleCount = 0;
  }

  process(inputs) {
    const channels = inputs[0];
    if (!channels?.length) return true;

    const output = [];
    for (let index = 0; index < channels[0].length; index += 1) {
      let mono = 0;
      for (const channel of channels) mono += channel[index] ?? 0;
      mono /= channels.length;

      this.sampleAccumulator += mono;
      this.sampleCount += 1;
      this.rateAccumulator += this.targetRate;

      if (this.rateAccumulator >= sampleRate) {
        this.rateAccumulator -= sampleRate;
        const average = this.sampleAccumulator / this.sampleCount;
        const clamped = Math.max(-1, Math.min(1, average));
        output.push(clamped < 0 ? clamped * 32768 : clamped * 32767);
        this.sampleAccumulator = 0;
        this.sampleCount = 0;
      }
    }

    if (output.length) {
      const chunk = Int16Array.from(output);
      this.port.postMessage(chunk, [chunk.buffer]);
    }
    return true;
  }
}

registerProcessor("pcm-recorder", PcmRecorderProcessor);
