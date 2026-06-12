import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// --- Mocks for the audio/camera plumbing -----------------------------------

const createPlayer = vi.fn();
vi.mock('../../audio/playback', () => ({
  createPlayer: (...args: unknown[]) => createPlayer(...args),
}));

vi.mock('../../audio/pcm', () => ({
  floatTo16BitPCM: (f: Float32Array) => f.buffer,
}));

// A controllable mock camera. The hook reacts to `active` flipping.
let cameraActive = false;
const cameraStop = vi.fn(() => {
  cameraActive = false;
});
const streamRef = { current: {} as unknown as MediaStream };
const grabFrame = vi.fn(async () => null);
vi.mock('../useCamera', () => ({
  useCamera: () => ({
    active: cameraActive,
    error: '',
    videoRef: { current: null },
    streamRef,
    start: vi.fn(),
    stop: cameraStop,
    grabFrame,
  }),
}));

// Track AudioContext instances so we can assert close() on teardown.
class MockAudioContext {
  static instances: MockAudioContext[] = [];
  state: 'running' | 'closed' = 'running';
  sampleRate: number;
  destination = {};
  audioWorklet = { addModule: vi.fn(async () => {}) };
  constructor(opts?: { sampleRate?: number }) {
    this.sampleRate = opts?.sampleRate ?? 44100;
    MockAudioContext.instances.push(this);
  }
  createMediaStreamSource() {
    return { connect: vi.fn() };
  }
  close = vi.fn(async () => {
    this.state = 'closed';
  });
}

class MockAudioWorkletNode {
  port = { onmessage: null as ((e: MessageEvent) => void) | null };
  disconnect = vi.fn();
  constructor() {}
}

import { useRealtimeVision } from '../useRealtimeVision';

function flushMicrotasks() {
  return act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('useRealtimeVision pipeline lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cameraActive = false;
    cameraStop.mockClear();
    grabFrame.mockClear();
    createPlayer.mockReset();
    createPlayer.mockReturnValue({ playPcm: vi.fn(), reset: vi.fn() });
    MockAudioContext.instances = [];
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('AudioWorkletNode', MockAudioWorkletNode);
    vi.stubGlobal('location', { protocol: 'http:', host: 'localhost:5173' });
    // jsdom WebSocket: a no-op so realtime.connect() does not throw.
    vi.stubGlobal(
      'WebSocket',
      class {
        static OPEN = 1;
        readyState = 1;
        onopen?: () => void;
        onclose?: () => void;
        onerror?: () => void;
        onmessage?: (e: unknown) => void;
        close() {}
        send() {}
      }
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('creates a 24kHz playback context and starts the frame timer only after the worklet loads', async () => {
    const { rerender } = renderHook(() => useRealtimeVision(vi.fn()));

    // Activate the camera -> effect runs.
    cameraActive = true;
    rerender();
    // The playback context is created synchronously in the effect body.
    const playbackCtx = MockAudioContext.instances.find(
      (c) => c.sampleRate === 24000
    );
    expect(playbackCtx).toBeDefined();
    expect(createPlayer).toHaveBeenCalledWith(playbackCtx);

    // Before the async worklet load resolves, no frame timer should be running.
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(grabFrame).not.toHaveBeenCalled();

    // Let the audio IIFE (addModule await) settle, then the timer starts.
    await flushMicrotasks();
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(grabFrame).toHaveBeenCalled();
  });

  it('closes both audio contexts and resets the player on stop (no leak across start/stop/start)', async () => {
    const { rerender } = renderHook(() => useRealtimeVision(vi.fn()));

    // --- start ---
    cameraActive = true;
    rerender();
    await flushMicrotasks();

    const player1 = createPlayer.mock.results[0].value as {
      reset: ReturnType<typeof vi.fn>;
    };
    const firstRunContexts = [...MockAudioContext.instances];
    expect(firstRunContexts.length).toBe(2); // capture + playback

    // --- stop ---
    act(() => {
      cameraActive = false;
      rerender();
    });

    // Every context created in the first run must be closed by cleanup.
    for (const ctx of firstRunContexts) {
      expect(ctx.close).toHaveBeenCalledTimes(1);
    }
    expect(player1.reset).toHaveBeenCalledTimes(1);

    // --- start again ---
    act(() => {
      cameraActive = true;
      rerender();
    });
    await flushMicrotasks();

    // A fresh pair of contexts is created; the old ones stay closed (not reused).
    const secondRunContexts = MockAudioContext.instances.filter(
      (c) => !firstRunContexts.includes(c)
    );
    expect(secondRunContexts.length).toBe(2);
    for (const ctx of firstRunContexts) {
      expect(ctx.close).toHaveBeenCalledTimes(1); // still exactly once
    }
  });

  it('stop() delegates to camera.stop so the cleanup effect fires', () => {
    cameraActive = true;
    const { result } = renderHook(() => useRealtimeVision(vi.fn()));
    act(() => result.current.stop());
    expect(cameraStop).toHaveBeenCalled();
  });
});
