import { useCallback, useEffect, useRef } from 'react';
import { useCamera } from './useCamera';
import { useRealtime } from './useRealtime';
import { floatTo16BitPCM } from '../audio/pcm';
import { playPcm } from '../audio/playback';

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const VISION_FPS = 1.5;
const WORKLET_URL = new URL('../audio/pcm-worklet.js', import.meta.url);

function realtimeUrl(): string {
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  // In dev, Vite proxies /ws to the backend; in prod the same-origin path works.
  return `${proto}://${location.host}/ws/realtime`;
}

export interface UseRealtimeVisionResult {
  active: boolean;
  error: string;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  start: () => Promise<void>;
  stop: () => void;
}

/**
 * Wire the camera + microphone to the backend realtime bridge:
 *  - microphone -> AudioWorklet -> PCM16 16kHz -> upstream
 *  - video -> ~1.5fps JPEG frames -> upstream
 *  - downstream audio (PCM16 24kHz) -> Web Audio playback
 *  - downstream transcript -> onTranscript callback
 */
export function useRealtimeVision(
  onTranscript: (text: string) => void
): UseRealtimeVisionResult {
  const camera = useCamera();
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const realtime = useRealtime(realtimeUrl(), {
    onTranscript: (t) => onTranscriptRef.current(t),
    onAudio: (pcm) => playPcm(pcm, OUTPUT_SAMPLE_RATE),
  });

  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const frameTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const teardownPipeline = useCallback(() => {
    if (frameTimerRef.current) {
      clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      void audioCtxRef.current.close();
    }
    audioCtxRef.current = null;
    realtime.disconnect();
  }, [realtime]);

  // Build the upstream audio + video pipeline once the camera is active.
  useEffect(() => {
    if (!camera.active) {
      return;
    }
    let cancelled = false;
    realtime.connect();

    (async () => {
      const stream = camera.streamRef.current;
      if (!stream) {
        return;
      }
      const ctx = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
      audioCtxRef.current = ctx;
      await ctx.audioWorklet.addModule(WORKLET_URL);
      if (cancelled) {
        return;
      }
      const source = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, 'pcm-worklet');
      workletNodeRef.current = node;
      node.port.onmessage = (e: MessageEvent) => {
        realtime.sendAudio(floatTo16BitPCM(e.data as Float32Array));
      };
      source.connect(node);
    })().catch((err) => {
      console.error('[RealtimeVision] audio pipeline error:', err);
    });

    frameTimerRef.current = setInterval(() => {
      void (async () => {
        const blob = await camera.grabFrame();
        if (blob) {
          realtime.sendImage(await blob.arrayBuffer());
        }
      })();
    }, 1000 / VISION_FPS);

    return () => {
      cancelled = true;
      teardownPipeline();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.active]);

  const stop = useCallback(() => {
    teardownPipeline();
    camera.stop();
  }, [teardownPipeline, camera]);

  return {
    active: camera.active,
    error: camera.error,
    videoRef: camera.videoRef,
    start: camera.start,
    stop,
  };
}
