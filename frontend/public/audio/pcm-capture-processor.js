/**
 * PCM capture AudioWorklet for ParLeap STT.
 * Runs on the audio rendering thread: converts Float32 input to Int16 PCM and posts
 * fixed-size chunks (default 1024 samples = 64 ms @ 16 kHz) to the main thread.
 * Replaces the deprecated ScriptProcessorNode.
 */
class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const chunkSize = (options && options.processorOptions && options.processorOptions.chunkSize) || 1024;
    this.chunkSize = chunkSize;
    this.buffer = new Int16Array(chunkSize);
    this.offset = 0;
    this.enabled = true;
    this.port.onmessage = (e) => {
      if (e.data && typeof e.data.enabled === 'boolean') {
        this.enabled = e.data.enabled;
        if (!this.enabled) this.offset = 0;
      }
    };
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel || !this.enabled) return true;
    for (let i = 0; i < channel.length; i++) {
      const clamped = Math.max(-1, Math.min(1, channel[i]));
      this.buffer[this.offset++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      if (this.offset === this.chunkSize) {
        const out = this.buffer;
        this.port.postMessage(out.buffer, [out.buffer]);
        this.buffer = new Int16Array(this.chunkSize);
        this.offset = 0;
      }
    }
    return true;
  }
}

registerProcessor('pcm-capture-processor', PcmCaptureProcessor);
