/**
 * Convert a webm/opus audio Blob to WAV format using the Web Audio API.
 * This removes the dependency on ffmpeg for server-side conversion.
 */
export async function blobToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new AudioContext({ sampleRate: 16000 });

  try {
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Down-mix to mono
    const numberOfChannels = 1;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const samples = audioBuffer.getChannelData(0);

    // If the decoded sample rate differs from 16kHz, resample via OfflineAudioContext
    let finalSamples: Float32Array;
    let finalSampleRate: number;

    if (sampleRate !== 16000) {
      const targetLength = Math.round(length * 16000 / sampleRate);
      const offlineCtx = new OfflineAudioContext(numberOfChannels, targetLength, 16000);
      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(offlineCtx.destination);
      source.start(0);
      const resampled = await offlineCtx.startRendering();
      finalSamples = resampled.getChannelData(0);
      finalSampleRate = 16000;
    } else {
      finalSamples = samples;
      finalSampleRate = sampleRate;
    }

    // Encode as 16-bit PCM WAV
    const wavBuffer = encodeWav(finalSamples, finalSampleRate);
    return new Blob([wavBuffer], { type: 'audio/wav' });
  } finally {
    await audioContext.close();
  }
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = samples.length * (bitsPerSample / 8);
  const headerSize = 44;

  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // sub-chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Convert float32 samples to int16
  let offset = headerSize;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return buffer;
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
