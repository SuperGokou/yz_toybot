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
import logging
from typing import Callable, Optional

logger = logging.getLogger(__name__)

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
#
# Verified against the installed SDK source (dashscope/audio/qwen_omni/
# omni_realtime.py): the assistant transcript arrives as a stream of
# ``response.audio_transcript.delta`` events (each carrying an incremental
# ``delta`` string). The SDK forwards *every* server event to ``on_event``
# unchanged, but its own internal bookkeeping only references ``delta`` and
# ``response.done`` — it never references a ``...transcript.done`` event. To be
# robust to both delta-only and delta+done server behaviour we accumulate the
# deltas and flush the buffer on EITHER ``...transcript.done`` OR
# ``response.done``.
_EVT_AUDIO_DELTA = "response.audio.delta"
_EVT_TRANSCRIPT_DELTA = "response.audio_transcript.delta"
_EVT_TRANSCRIPT_DONE = "response.audio_transcript.done"
_EVT_RESPONSE_DONE = "response.done"
# User speech transcription completion: the installed SDK version does NOT emit
# a user input-audio-transcription event (no such type is referenced anywhere in
# omni_realtime.py, and the callback only forwards what the server sends). The
# handling branch below is retained for forward-compatibility but is dormant on
# this SDK version. Revisit when the SDK/service begins emitting it.
_EVT_USER_TRANSCRIPT = "conversation.item.input_audio_transcription.completed"


def _default_factory(model: str, callback, url: str, api_key: str = ""):
    if OmniRealtimeConversation is None:  # pragma: no cover - no SDK installed
        raise RuntimeError(
            "dashscope qwen_omni SDK is not available; inject conversation_factory."
        )
    # The SDK auto-appends ``?model=<model>`` to the URL, so a configured url must
    # not already carry one or it would be duplicated. Strip any query string.
    clean_url = url.split("?", 1)[0] if url else url
    return OmniRealtimeConversation(
        model=model,
        callback=callback,
        url=clean_url,
        # SDK falls back to dashscope.api_key when api_key is None.
        api_key=api_key or None,
    )


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
        api_key: str = "",
    ):
        self._factory = conversation_factory or _default_factory
        self._model = model
        self._url = url
        self._voice = voice
        self._instructions = instructions
        self._api_key = api_key
        self._queue: asyncio.Queue = asyncio.Queue()
        # The running loop is captured in ``connect()`` (which runs on the
        # asyncio side) rather than here. ``asyncio.get_event_loop()`` is
        # deprecated/unreliable in 3.12+ when no loop is running.
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self._conv = None
        # Accumulates ``response.audio_transcript.delta`` text until a flush.
        self._transcript_buffer: str = ""

    # -- internal: thread-safe emit into the asyncio queue --------------------
    def _emit(self, item: dict) -> None:
        self._loop.call_soon_threadsafe(self._queue.put_nowait, item)

    def _flush_transcript(self) -> None:
        """Emit the accumulated transcript (if any) and reset the buffer."""
        text = self._transcript_buffer
        self._transcript_buffer = ""
        if text:
            self._emit({"kind": "transcript", "text": text})

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
        elif event_type == _EVT_TRANSCRIPT_DELTA:
            # Accumulate incremental assistant transcript text.
            self._transcript_buffer += message.get("delta", "") or ""
        elif event_type in (_EVT_TRANSCRIPT_DONE, _EVT_RESPONSE_DONE):
            # Flush the full assistant transcript. Handling both event types
            # covers delta+done and delta-only SDK/service behaviour.
            self._flush_transcript()
        elif event_type == _EVT_USER_TRANSCRIPT:
            # Dormant on the current SDK version (see _EVT_USER_TRANSCRIPT note).
            self._emit(
                {"kind": "user_transcript", "text": message.get("transcript", "")}
            )

    async def connect(self) -> None:
        # Capture the running loop here (on the asyncio side) so SDK callback
        # threads can hand events back via call_soon_threadsafe.
        self._loop = asyncio.get_running_loop()
        bridge = self

        class _CB(OmniRealtimeCallback):
            def on_open(self):  # noqa: D401 - SDK callback
                pass

            def on_close(self, close_status_code=None, close_msg=None):
                bridge._emit({"kind": "close"})

            def on_event(self, message):
                bridge._handle_event(message)

        self._conv = self._factory(
            model=self._model,
            callback=_CB(),
            url=self._url,
            api_key=self._api_key,
        )
        self._conv.connect()
        # ``instructions`` is passed through as a kwarg. Per the installed SDK
        # source, update_session(**kwargs) merges kwargs into the session config
        # and sends them in the ``session.update`` frame, so the SDK does forward
        # ``instructions`` to the service. Whether the realtime service honours
        # the field in session.update (vs. requiring a system message) could not
        # be confirmed without a live connection — verification status: PENDING.
        self._conv.update_session(
            output_modalities=[MultiModality.AUDIO, MultiModality.TEXT],
            voice=self._voice,
            instructions=self._instructions,
        )

    async def trigger_response(self, instructions: str = "") -> None:
        """Proactively ask the model to speak, using audio/video sent so far.

        In server_vad mode the service auto-responds to the child's speech; this
        is for VV to *open the conversation* (or otherwise speak unprompted),
        e.g. greeting and commenting on what the camera currently shows. Safe to
        call once a few frames have been buffered. No-op if the SDK conversation
        object does not expose ``create_response``.
        """
        create = getattr(self._conv, "create_response", None)
        if callable(create):
            create(instructions=instructions or None)

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
        # No known image-frame uplink method on this SDK version. The installed
        # SDK exposes ``append_video`` so this is not expected to trigger; if it
        # does (version drift), drop the frame but make it observable rather than
        # silently losing video while audio + text still work.
        logger.warning(
            "OmniBridge: no image-frame uplink method found on conversation "
            "(tried append_video/append_image/append_video_frame); dropping %d-byte frame.",
            len(jpeg),
        )

    async def events(self) -> dict:
        """Await the next normalized downstream event."""
        return await self._queue.get()

    async def close(self) -> None:
        if self._conv is not None and hasattr(self._conv, "close"):
            self._conv.close()
