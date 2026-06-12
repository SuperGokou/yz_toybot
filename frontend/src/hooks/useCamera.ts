import { useCallback, useEffect, useRef, useState } from 'react';

const JPEG_QUALITY = 0.6;

export type CameraFacing = 'user' | 'environment';

export interface UseCameraResult {
  active: boolean;
  error: string;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  streamRef: React.MutableRefObject<MediaStream | null>;
  start: (facing?: CameraFacing) => Promise<void>;
  stop: () => void;
  grabFrame: () => Promise<Blob | null>;
}

/**
 * Manage a camera + microphone MediaStream via getUserMedia.
 *
 * - `start(facing)` requests video (with the given facingMode) plus audio with
 *   echo cancellation / noise suppression, attaches the stream to `videoRef`,
 *   and flips `active` to true (or records `error` on failure).
 * - `stop()` stops all tracks and resets state.
 * - `grabFrame()` captures the current video frame as a JPEG Blob.
 */
export function useCamera(): UseCameraResult {
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setActive(false);
  }, []);

  const start = useCallback(async (facing: CameraFacing = 'environment') => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setActive(true);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setActive(false);
    }
  }, []);

  const grabFrame = useCallback((): Promise<Blob | null> => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      return Promise.resolve(null);
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return Promise.resolve(null);
    }
    ctx.drawImage(video, 0, 0);
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', JPEG_QUALITY);
    });
  }, []);

  // Ensure tracks are released if the component unmounts while active.
  useEffect(() => stop, [stop]);

  return { active, error, videoRef, streamRef, start, stop, grabFrame };
}
