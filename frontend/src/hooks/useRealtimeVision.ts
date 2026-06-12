import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCamera } from './useCamera';
import { useRealtime } from './useRealtime';
import { floatTo16BitPCM } from '../audio/pcm';
import { createPlayer, type PcmPlayer } from '../audio/playback';

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const VISION_FPS = 1.5;
const WORKLET_URL = new URL('../audio/pcm-worklet.js', import.meta.url);

function buildRealtimeUrl(): string {
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

  const [pipelineError, setPipelineError] = useState('');

  // Stable across renders so the realtime hook's connect() reference does not
  // change every render and re-run the effect.
  const realtimeUrl = useMemo(() => buildRealtimeUrl(), []);

  // The downstream player needs a context; created lazily per session in the
  // effect. Hold it in a ref so onAudio (a stable callback) can reach it.
  const playerRef = useRef<PcmPlayer | null>(null);

  const realtime = useRealtime(realtimeUrl, {
    onTranscript: (t) => onTranscriptRef.current(t),
    onAudio: (pcm) => playerRef.current?.playPcm(pcm, OUTPUT_SAMPLE_RATE),
    onError: (message) => setPipelineError(message),
  });

  // Hold the stable realtime API in a ref so the camera-active effect does not
  // need `realtime` in its dependency list (its methods are already stable, but
  // referencing the object would still widen deps).
  const realtimeRef = useRef(realtime);
  realtimeRef.current = realtime;

  // Capture a frame from the camera without depending on the camera object in
  // the effect deps.
  const grabFrameRef = useRef(camera.grabFrame);
  grabFrameRef.current = camera.grabFrame;
  const streamRef = camera.streamRef;

  // Build the upstream audio + video pipeline once the camera is active.
  // All mutable resources live in effect-local closures so the cleanup tears
  // down exactly what this run created — no stale external references.
  useEffect(() => {
    if (!camera.active) {
      return;
    }

    let cancelled = false;
    let captureCtx: AudioContext | null = null;
    let playbackCtx: AudioContext | null = null;
    let workletNode: AudioWorkletNode | null = null;
    let frameTimer: ReturnType<typeof setInterval> | null = null;

    const rt = realtimeRef.current;
    rt.connect();

    // Dedicated 24kHz playback context: matches the backend's PCM16 24kHz so no
    // per-frame resampling, and its lifecycle is owned by this effect run.
    playbackCtx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
    playerRef.current = createPlayer(playbackCtx);

    (async () => {
      const stream = streamRef.current;
      if (!stream) {
        return;
      }
      const ctx = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
      captureCtx = ctx;
      await ctx.audioWorklet.addModule(WORKLET_URL);
      if (cancelled) {
        return;
      }
      const source = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, 'pcm-worklet');
      workletNode = node;
      node.port.onmessage = (e: MessageEvent) => {
        rt.sendAudio(floatTo16BitPCM(e.data as Float32Array));
      };
      source.connect(node);

      // Only start sending video frames once the audio pipeline is ready, so
      // images never arrive ahead of the audio stream.
      frameTimer = setInterval(() => {
        void (async () => {
          const blob = await grabFrameRef.current();
          if (blob) {
            rt.sendImage(await blob.arrayBuffer());
          }
        })();
      }, 1000 / VISION_FPS);
    })().catch((err) => {
      if (!cancelled) {
        const message = err instanceof Error ? err.message : String(err);
        setPipelineError(`audio pipeline error: ${message}`);
      }
    });

    return () => {
      cancelled = true;
      if (frameTimer) {
        clearInterval(frameTimer);
      }
      workletNode?.disconnect();
      if (captureCtx && captureCtx.state !== 'closed') {
        void captureCtx.close();
      }
      playerRef.current?.reset();
      playerRef.current = null;
      if (playbackCtx && playbackCtx.state !== 'closed') {
        void playbackCtx.close();
      }
      rt.disconnect();
    };
  }, [camera.active, streamRef]);

  const stop = useCallback(() => {
    // Tearing down the pipeline is handled by the effect cleanup, which fires
    // when `camera.active` flips to false.
    camera.stop();
  }, [camera]);

  return {
    active: camera.active,
    error: pipelineError || camera.error,
    videoRef: camera.videoRef,
    start: camera.start,
    stop,
  };
}
