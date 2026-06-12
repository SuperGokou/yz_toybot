"""OmniBridge — bridges one browser session to Qwen-Omni Realtime.

Design notes
------------
- The bridge does not require the real DashScope SDK or network. A
  ``conversation_factory`` is injected (defaulting to the real
  ``OmniRealtimeConversation``); tests pass a Fake.
- SDK callbacks fire on the SDK's own thread. Events are handed to the asyncio
  side via ``loop.call_soon_threadsafe`` into an ``asyncio.Queue`` so the
  ``/ws/realtime`` downstream pump can ``await`` them safely.
- The SDK's ``OmniRealtimeCallback.on_event(message)`` receives a single event
  payload (a dict). We normalize the events we care about into
  ``{"kind": ..., ...}`` items.

Normalized event kinds emitted by ``events()``:
- ``{"kind": "audio", "data": <pcm bytes>}``        assistant audio (PCM16 24kHz)
- ``{"kind": "transcript", "text": <str>}``         assistant text transcript
- ``{"kind": "user_transcript", "text": <str>}``    user speech transcription
- ``{"kind": "close"}``                             session closed
"""

import asyncio
import base64
from typing import Callable, Optional

try:  # Real SDK; absent or offline in some test/CI environments.
    from dashscope.audio.qwen_omni import (
        OmniRealtimeConversation,
        OmniRealtimeCallback,
        MultiModality,
    )

    _SDK_AVAILABLE = True
except Exception:  # pragma: no cover - exercised only when SDK is missing
    OmniRealtimeConversation = None  # type: ignore

    class OmniRealtimeCallback:  # type: ignore
        """Fallback base callback when the SDK is unavailable."""

        def on_open(self):
            pass

        def on_close(self, close_status_code=None, close_msg=None):
            pass

        def on_event(self, message):
            pass

    class MultiModality:  # type: ignore
        AUDIO = "audio"
        TEXT = "text"

    _SDK_AVAILABLE = False


# Event type strings emitted by the Qwen-Omni realtime service.
_EVT_AUDIO_DELTA = "response.audio.delta"
_EVT_ASSISTANT_TRANSCRIPT = "response.audio_transcript.done"
_EVT_USER_TRANSCRIPT = "conversation.item.input_audio_transcription.completed"


def _default_factory(model: str, callback, url: str):
    if OmniRealtimeConversation is None:  # pragma: no cover - no SDK installed
        raise RuntimeError(
            "dashscope qwen_omni SDK is not available; inject conversation_factory."
        )
    return OmniRealtimeConversation(model=model, callback=callback, url=url)


class OmniBridge:
    """Bridge a browser realtime session to a Qwen-Omni Realtime conversation."""

    def __init__(
        self,
        *,
        conversation_factory: Optional[Callable] = None,
        model: str,
        url: str,
        voice: str,
        instructions: str,
    ):
        self._factory = conversation_factory or _default_factory
        self._model = model
        self._url = url
        self._voice = voice
        self._instructions = instructions
        self._queue: asyncio.Queue = asyncio.Queue()
        self._loop = asyncio.get_event_loop()
        self._conv = None

    # -- internal: thread-safe emit into the asyncio queue --------------------
    def _emit(self, item: dict) -> None:
        self._loop.call_soon_threadsafe(self._queue.put_nowait, item)

    def _handle_event(self, message) -> None:
        """Normalize an SDK event payload into a queued item.

        Robust to non-dict payloads (ignored) so a malformed event never crashes
        the SDK callback thread.
        """
        if not isinstance(message, dict):
            return
        event_type = message.get("type")
        if event_type == _EVT_AUDIO_DELTA:
            delta = message.get("delta")
            if delta:
                self._emit({"kind": "audio", "data": base64.b64decode(delta)})
        elif event_type == _EVT_ASSISTANT_TRANSCRIPT:
            self._emit({"kind": "transcript", "text": message.get("transcript", "")})
        elif event_type == _EVT_USER_TRANSCRIPT:
            self._emit(
                {"kind": "user_transcript", "text": message.get("transcript", "")}
            )

    async def connect(self) -> None:
        bridge = self

        class _CB(OmniRealtimeCallback):
            def on_open(self):  # noqa: D401 - SDK callback
                pass

            def on_close(self, close_status_code=None, close_msg=None):
                bridge._emit({"kind": "close"})

            def on_event(self, message):
                bridge._handle_event(message)

        self._conv = self._factory(model=self._model, callback=_CB(), url=self._url)
        self._conv.connect()
        self._conv.update_session(
            output_modalities=[MultiModality.AUDIO, MultiModality.TEXT],
            voice=self._voice,
            instructions=self._instructions,
        )

    async def send_audio(self, pcm: bytes) -> None:
        """Forward a PCM16 audio chunk upstream (base64-encoded)."""
        self._conv.append_audio(base64.b64encode(pcm).decode())

    async def send_image(self, jpeg: bytes) -> None:
        """Forward a JPEG camera frame upstream.

        The real SDK exposes ``append_video`` for image frames. We probe for
        alternate method names defensively in case of SDK version drift.
        """
        b64 = base64.b64encode(jpeg).decode()
        for method_name in ("append_video", "append_image", "append_video_frame"):
            method = getattr(self._conv, method_name, None)
            if callable(method):
                method(b64)
                return
        # No known image method on this SDK version. Skip silently rather than
        # crash the realtime loop; audio + text still work.
        # TODO: revisit if a future SDK renames the image-frame uplink method.

    async def events(self) -> dict:
        """Await the next normalized downstream event."""
        return await self._queue.get()

    async def close(self) -> None:
        if self._conv is not None and hasattr(self._conv, "close"):
            self._conv.close()
