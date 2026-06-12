import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCamera } from '../useCamera';

describe('useCamera', () => {
  beforeEach(() => {
    (navigator as any).mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [] }),
    };
  });

  it('start() requests camera+mic and sets active', async () => {
    const { result } = renderHook(() => useCamera());
    await act(async () => {
      await result.current.start();
    });
    await waitFor(() => expect(result.current.active).toBe(true));
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
    const constraints = (navigator.mediaDevices.getUserMedia as any).mock.calls[0][0];
    expect(constraints.video).toBeTruthy();
    expect(constraints.audio).toMatchObject({
      echoCancellation: true,
      noiseSuppression: true,
    });
  });

  it('start() surfaces permission error and stays inactive', async () => {
    (navigator.mediaDevices.getUserMedia as any).mockRejectedValueOnce(
      new Error('denied')
    );
    const { result } = renderHook(() => useCamera());
    await act(async () => {
      await result.current.start();
    });
    await waitFor(() => expect(result.current.error).toMatch(/denied/));
    expect(result.current.active).toBe(false);
  });

  it('stop() stops all tracks and clears active', async () => {
    const stopTrack = vi.fn();
    (navigator.mediaDevices.getUserMedia as any).mockResolvedValueOnce({
      getTracks: () => [{ stop: stopTrack }],
    });
    const { result } = renderHook(() => useCamera());
    await act(async () => {
      await result.current.start();
    });
    act(() => {
      result.current.stop();
    });
    expect(stopTrack).toHaveBeenCalled();
    expect(result.current.active).toBe(false);
  });

  it('grabFrame() returns null when no video frame is available', async () => {
    const { result } = renderHook(() => useCamera());
    const frame = await result.current.grabFrame();
    expect(frame).toBeNull();
  });
});
