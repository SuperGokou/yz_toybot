import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRealtime } from '../useRealtime';

class MockWS {
  static last: MockWS;
  static OPEN = 1;
  readyState = MockWS.OPEN;
  onopen?: () => void;
  onmessage?: (e: { data: string }) => void;
  onclose?: () => void;
  onerror?: () => void;
  sent: string[] = [];
  closed = false;

  constructor(public url: string) {
    MockWS.last = this;
    setTimeout(() => this.onopen?.(), 0);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
    this.onclose?.();
  }
}

describe('useRealtime', () => {
  beforeEach(() => {
    (globalThis as any).WebSocket = MockWS;
  });

  it('connect() opens a WebSocket to the given url', async () => {
    const { result } = renderHook(() => useRealtime('ws://x/ws/realtime'));
    await act(async () => {
      result.current.connect();
      await Promise.resolve();
    });
    expect(MockWS.last.url).toBe('ws://x/ws/realtime');
  });

  it('sendAudio encodes a base64 audio frame', async () => {
    const { result } = renderHook(() => useRealtime('ws://x/ws/realtime'));
    await act(async () => {
      result.current.connect();
      await Promise.resolve();
    });
    act(() => result.current.sendAudio(new Uint8Array([0, 1, 2]).buffer));
    const msg = JSON.parse(MockWS.last.sent[0]);
    expect(msg.type).toBe('audio');
    expect(typeof msg.data).toBe('string');
    // Round-trip the base64 back to bytes.
    const bytes = Uint8Array.from(atob(msg.data), (c) => c.charCodeAt(0));
    expect(Array.from(bytes)).toEqual([0, 1, 2]);
  });

  it('sendImage encodes a base64 image frame', async () => {
    const { result } = renderHook(() => useRealtime('ws://x/ws/realtime'));
    await act(async () => {
      result.current.connect();
      await Promise.resolve();
    });
    act(() => result.current.sendImage(new Uint8Array([255, 0]).buffer));
    const msg = JSON.parse(MockWS.last.sent[0]);
    expect(msg.type).toBe('image');
    expect(typeof msg.data).toBe('string');
  });

  it('incoming transcript fires onTranscript callback', async () => {
    const onTranscript = vi.fn();
    const { result } = renderHook(() =>
      useRealtime('ws://x/ws/realtime', { onTranscript })
    );
    await act(async () => {
      result.current.connect();
      await Promise.resolve();
    });
    act(() =>
      MockWS.last.onmessage?.({
        data: JSON.stringify({ type: 'transcript', text: '嗨' }),
      })
    );
    expect(onTranscript).toHaveBeenCalledWith('嗨');
  });

  it('incoming audio fires onAudio with decoded bytes', async () => {
    const onAudio = vi.fn();
    const { result } = renderHook(() =>
      useRealtime('ws://x/ws/realtime', { onAudio })
    );
    await act(async () => {
      result.current.connect();
      await Promise.resolve();
    });
    const b64 = btoa(String.fromCharCode(1, 2, 3));
    act(() =>
      MockWS.last.onmessage?.({
        data: JSON.stringify({ type: 'audio', data: b64 }),
      })
    );
    expect(onAudio).toHaveBeenCalledTimes(1);
    const buf = onAudio.mock.calls[0][0] as ArrayBuffer;
    expect(Array.from(new Uint8Array(buf))).toEqual([1, 2, 3]);
  });

  it('disconnect() closes the socket', async () => {
    const { result } = renderHook(() => useRealtime('ws://x/ws/realtime'));
    await act(async () => {
      result.current.connect();
      await Promise.resolve();
    });
    act(() => result.current.disconnect());
    expect(MockWS.last.closed).toBe(true);
  });
});
