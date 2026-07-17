// AudioWorklet that forwards raw Float32 PCM frames to the main thread.
// Raw PCM capture (instead of MediaRecorder/Opus) keeps the pitch content
// of hums untouched by codecs and voice processing.
class CaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel && channel.length > 0) {
      // Copy: the engine reuses the underlying buffer between callbacks.
      this.port.postMessage(channel.slice(0));
    }
    return true;
  }
}

registerProcessor('capture', CaptureProcessor);
