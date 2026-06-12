import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createPlayer } from '../playback';

interface FakeBuffer {
  copyToChannel: ReturnType<typeof vi.fn>;
  duration: number;
}

interface FakeSource {
  buffer: FakeBuffer | null;
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
}

function makeCtx(currentTime = 0) {
  const copyToChannel = vi.fn();
  const sources: FakeSource[] = [];
  const ctx = {
    currentTime,
    destination: {},
    // 24kHz mono buffer => duration = length / sampleRate.
    createBuffer: vi.fn((_ch: number, length: number, sampleRate: number) => ({
      copyToChannel,
      duration: length / sampleRate,
    })),
    createBufferSource: vi.fn((): FakeSource => {
      const src: FakeSource = {
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
      };
      sources.push(src);
      return src;
    }),
  };
  return { ctx, sources, copyToChannel };
}

describe('createPlayer', () => {
  let fake: ReturnType<typeof makeCtx>;
  let player: ReturnType<typeof createPlayer>;

  beforeEach(() => {
    fake = makeCtx(0);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    player = createPlayer(fake.ctx as any);
  });

  it('decodes PCM16 into a mono buffer at the given sample rate and starts playback', () => {
    // Two int16 samples: 0x4000 (=> ~0.5) and -0x4000 (=> -0.5), little-endian.
    const pcm = new Int16Array([0x4000, -0x4000]).buffer;
    player.playPcm(pcm, 24000);

    expect(fake.ctx.createBuffer).toHaveBeenCalledWith(1, 2, 24000);
    const channelData = fake.copyToChannel.mock.calls[0][0] as Float32Array;
    expect(channelData.length).toBe(2);
    expect(channelData[0]).toBeCloseTo(0.5, 2);
    expect(channelData[1]).toBeCloseTo(-0.5, 2);
    expect(fake.sources[0].connect).toHaveBeenCalled();
    expect(fake.sources[0].start).toHaveBeenCalled();
  });

  it('schedules consecutive chunks back-to-back without overlap', () => {
    // Each chunk: 24000 samples at 24kHz => 1.0s duration.
    const chunk = new Int16Array(24000).buffer;
    player.playPcm(chunk, 24000);
    player.playPcm(chunk, 24000);
    player.playPcm(chunk, 24000);

    const t0 = fake.sources[0].start.mock.calls[0][0] as number;
    const t1 = fake.sources[1].start.mock.calls[0][0] as number;
    const t2 = fake.sources[2].start.mock.calls[0][0] as number;

    expect(t0).toBeCloseTo(0, 5);
    expect(t1).toBeCloseTo(1, 5);
    expect(t2).toBeCloseTo(2, 5);
  });

  it('does not schedule a chunk in the past when ctx.currentTime advances', () => {
    const chunk = new Int16Array(24000).buffer; // 1.0s
    player.playPcm(chunk, 24000); // scheduled at 0, cursor -> 1.0

    // Simulate real time passing well beyond the queued cursor.
    fake.ctx.currentTime = 5;
    player.playPcm(chunk, 24000);

    const t1 = fake.sources[1].start.mock.calls[0][0] as number;
    expect(t1).toBeCloseTo(5, 5); // max(currentTime, nextPlayTime)
  });

  it('reset() rewinds the scheduling cursor', () => {
    const chunk = new Int16Array(24000).buffer; // 1.0s
    player.playPcm(chunk, 24000); // cursor -> 1.0
    player.reset();
    player.playPcm(chunk, 24000);

    const t = fake.sources[1].start.mock.calls[0][0] as number;
    expect(t).toBeCloseTo(0, 5);
  });
});
