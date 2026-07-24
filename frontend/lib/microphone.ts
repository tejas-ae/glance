import { PCM_SAMPLE_RATE_HZ } from "./pcm";

export async function connectMicrophone(
  context: AudioContext,
  onChunk: (chunk: Int16Array) => void,
) {
  const microphone = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
  });
  await context.audioWorklet.addModule("/worklets/recorder.js");
  const source = context.createMediaStreamSource(microphone);
  const recorder = new AudioWorkletNode(context, "pcm-recorder", {
    processorOptions: { targetSampleRate: PCM_SAMPLE_RATE_HZ },
  });
  const silentOutput = context.createGain();
  silentOutput.gain.value = 0;
  recorder.port.onmessage = (event: MessageEvent<Int16Array>) => {
    onChunk(event.data);
  };
  source.connect(recorder).connect(silentOutput).connect(context.destination);
  return microphone;
}
