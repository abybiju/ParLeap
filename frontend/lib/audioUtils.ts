/**
 * Audio Utilities for Hum-to-Search
 * Converts AudioBuffer to WAV format for backend processing
 */

/**
 * Convert AudioBuffer to WAV format
 * @param audioBuffer - The AudioBuffer to convert
 * @returns WAV file as ArrayBuffer
 */
export function audioBufferToWav(audioBuffer: AudioBuffer): ArrayBuffer {
  const numChannels = audioBuffer.numberOfChannels
  const sampleRate = audioBuffer.sampleRate
  const length = audioBuffer.length

  // Create a buffer for the WAV file
  const arrayBuffer = new ArrayBuffer(44 + length * numChannels * 2)
  const view = new DataView(arrayBuffer)

  // WAV header
  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + length * numChannels * 2, true)
  writeString(view, 8, 'WAVE')
  // fmt chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true) // chunk size
  view.setUint16(20, 1, true) // audio format (1 = PCM)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * 2, true) // byte rate
  view.setUint16(32, numChannels * 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  // data chunk
  writeString(view, 36, 'data')
  view.setUint32(40, length * numChannels * 2, true)

  // Convert float32 samples to int16 PCM
  let offset = 44
  for (let i = 0; i < length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, audioBuffer.getChannelData(channel)[i]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
      offset += 2
    }
  }

  return arrayBuffer
}

/**
 * Helper function to write strings to DataView
 */
function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

/**
 * Convert ArrayBuffer to base64 string
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
