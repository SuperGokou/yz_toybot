import { describe, it, expect, beforeEach, vi } from 'vitest';
import { playPcm, __resetPlaybackForTests } from '../playback';

describe('playPcm', () => {
  let createBuffer: ReturnType<typeof vi.fn>;
  let copyToChannel: ReturnType<typeof vi.fn>;
  let connect: ReturnType<typeof vi.fn>;
  let start: ReturnType<typeof vi.fn>;
  let createdBuffer: { copyToChannel: typeof copyToChannel };

  beforeEach(() => {
    __resetPlaybackForTests();
    copyToChannel = vi.fn();
    createdBuffer = { copyToChannel };
    createBuffer = vi.fn().mockReturnValue(createdBuffer);
    connect = vi.fn();
    start = vi.fn();

    function AudioContextMock(this: Record<string, unknown>) {
      this.destination = {};
      this.createBuffer = createBuffer;
      this.createBufferSource = () => ({ buffer: null, connect, start });
    }
    vi.stubGlobal('AudioContext', AudioContextMock);
  });

  it('decodes PCM16 into a 24kHz mono buffer and starts playback', () => {
    // Two int16 samples: 0x4000 (=> ~0.5) and -0x4000 (=> -0.5), little-endian.
    const pcm = new Int16Array([0x4000, -0x4000]).buffer;
    playPcm(pcm);

    expect(createBuffer).toHaveBeenCalledWith(1, 2, 24000);
    const channelData = copyToChannel.mock.calls[0][0] as Float32Array;
    expect(channelData.length).toBe(2);
    expect(channelData[0]).toBeCloseTo(0.5, 2);
    expect(channelData[1]).toBeCloseTo(-0.5, 2);
    expect(start).toHaveBeenCalled();
    expect(connect).toHaveBeenCalled();
  });

  it('honors a custom sample rate', () => {
    playPcm(new Int16Array([0]).buffer, 16000);
    expect(createBuffer).toHaveBeenCalledWith(1, 1, 16000);
  });
});
