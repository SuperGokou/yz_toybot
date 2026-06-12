import { useCallback, useRef } from 'react';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const buffer = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
}

export interface UseRealtimeOptions {
  onTranscript?: (text: string) => void;
  onAudio?: (pcm: ArrayBuffer) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export interface UseRealtimeResult {
  connect: () => void;
  disconnect: () => void;
  sendAudio: (pcm: ArrayBuffer) => void;
  sendImage: (jpeg: ArrayBuffer) => void;
}

/**
 * Connect to the backend `/ws/realtime` bridge.
 *
 * Upstream frames (browser -> backend):
 *   { type: "audio", data: <base64 PCM16 16kHz mono> }
 *   { type: "image", data: <base64 JPEG> }
 * Downstream frames (backend -> browser):
 *   { type: "audio", data: <base64 PCM16 24kHz mono> } -> onAudio(ArrayBuffer)
 *   { type: "transcript", text: "..." }                -> onTranscript(text)
 */
export function useRealtime(
  url: string,
  opts: UseRealtimeOptions = {}
): UseRealtimeResult {
  const wsRef = useRef<WebSocket | null>(null);
  // Keep latest callbacks without re-creating the socket handlers.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const connect = useCallback(() => {
    if (wsRef.current) {
      return;
    }
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => optsRef.current.onOpen?.();
    ws.onclose = () => {
      wsRef.current = null;
      optsRef.current.onClose?.();
    };
    ws.onmessage = (event: MessageEvent) => {
      let msg: { type?: string; text?: string; data?: string };
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.type === 'transcript' && typeof msg.text === 'string') {
        optsRef.current.onTranscript?.(msg.text);
      } else if (msg.type === 'audio' && typeof msg.data === 'string') {
        optsRef.current.onAudio?.(base64ToArrayBuffer(msg.data));
      }
    };
  }, [url]);

  const send = useCallback((type: 'audio' | 'image', buffer: ArrayBuffer) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      return;
    }
    ws.send(JSON.stringify({ type, data: arrayBufferToBase64(buffer) }));
  }, []);

  const sendAudio = useCallback((pcm: ArrayBuffer) => send('audio', pcm), [send]);
  const sendImage = useCallback((jpeg: ArrayBuffer) => send('image', jpeg), [send]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
  }, []);

  return { connect, disconnect, sendAudio, sendImage };
}
