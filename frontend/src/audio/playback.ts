const DEFAULT_OUTPUT_SAMPLE_RATE = 24000;

let playbackCtx: AudioContext | null = null;

function getContext(): AudioContext {
  if (!playbackCtx) {
    playbackCtx = new AudioContext();
  }
  return playbackCtx;
}

/**
 * Play a chunk of mono PCM16 audio (as received from the backend, default
 * 24kHz) through the Web Audio API. Each chunk is scheduled immediately; the
 * caller is responsible for ordering.
 */
export function playPcm(
  pcm: ArrayBuffer,
  sampleRate: number = DEFAULT_OUTPUT_SAMPLE_RATE
): void {
  const ctx = getContext();
  const int16 = new Int16Array(pcm);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 0x8000;
  }

  const buffer = ctx.createBuffer(1, float32.length, sampleRate);
  buffer.copyToChannel(float32, 0);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
}

/** Test-only: drop the cached AudioContext so each test starts fresh. */
export function __resetPlaybackForTests(): void {
  playbackCtx = null;
}
