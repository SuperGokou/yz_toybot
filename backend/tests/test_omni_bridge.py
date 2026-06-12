"""Tests for OmniBridge — wraps Qwen-Omni Realtime with a Fake conversation (Task 3).

OmniBridge must not require the real SDK or network: a ``conversation_factory``
is injected so callbacks and forwarding can be exercised in isolation.
"""

import asyncio
import base64

import pytest

from app.core.omni_bridge import OmniBridge


class FakeConversation:
    """Stand-in for OmniRealtimeConversation.

    Mirrors the real SDK surface used by OmniBridge: ``connect``,
    ``update_session(**kwargs)``, ``append_audio(b64)``, ``append_video(b64)``,
    ``close``. The injected callback's ``on_event`` is fed dict events.
    """

    def __init__(self, model, callback, url, api_key=None):
        self.model = model
        self.callback = callback
        self.url = url
        self.api_key = api_key
        self.sent_audio = []
        self.sent_video = []
        self.session = None
        self.connected = False

    def connect(self):
        self.connected = True
        self.callback.on_open()

    def update_session(self, **kwargs):
        self.session = kwargs

    def append_audio(self, b64):
        self.sent_audio.append(b64)

    def append_video(self, b64):
        self.sent_video.append(b64)

    def close(self):
        self.connected = False


def _make_bridge(**overrides):
    params = dict(
        conversation_factory=FakeConversation,
        model="m",
        url="u",
        voice="Cherry",
        instructions="你是VV",
    )
    params.update(overrides)
    return OmniBridge(**params)


async def test_bridge_connect_configures_session():
    bridge = _make_bridge()
    await bridge.connect()
    assert bridge._conv.connected is True
    assert bridge._conv.session["voice"] == "Cherry"
    assert bridge._conv.session["instructions"] == "你是VV"


async def test_bridge_forwards_audio():
    bridge = _make_bridge(instructions="x")
    await bridge.connect()
    await bridge.send_audio(b"\x00\x01")
    assert bridge._conv.sent_audio == [base64.b64encode(b"\x00\x01").decode()]


async def test_bridge_forwards_image():
    bridge = _make_bridge(instructions="x")
    await bridge.connect()
    await bridge.send_image(b"JPEGDATA")
    assert bridge._conv.sent_video == [base64.b64encode(b"JPEGDATA").decode()]


async def test_bridge_emits_audio_event():
    bridge = _make_bridge(instructions="x")
    await bridge.connect()
    bridge._conv.callback.on_event(
        {"type": "response.audio.delta", "delta": base64.b64encode(b"PCM").decode()}
    )
    out = await asyncio.wait_for(bridge.events(), 1)
    assert out["kind"] == "audio"
    assert out["data"] == b"PCM"


async def test_bridge_accumulates_transcript_deltas_and_flushes_on_done():
    """Real SDK emits ``response.audio_transcript.delta`` increments; the full
    transcript must be assembled and flushed on ``...transcript.done``."""
    bridge = _make_bridge(instructions="x")
    await bridge.connect()
    bridge._conv.callback.on_event(
        {"type": "response.audio_transcript.delta", "delta": "你好"}
    )
    bridge._conv.callback.on_event(
        {"type": "response.audio_transcript.delta", "delta": "小明"}
    )
    bridge._conv.callback.on_event({"type": "response.audio_transcript.done"})
    ev = await asyncio.wait_for(bridge.events(), 1)
    assert ev["kind"] == "transcript"
    assert ev["text"] == "你好小明"


async def test_bridge_flushes_transcript_on_response_done_when_no_transcript_done():
    """Some SDK versions are delta-only and never emit ``...transcript.done``;
    the accumulated transcript must still flush on ``response.done``."""
    bridge = _make_bridge(instructions="x")
    await bridge.connect()
    bridge._conv.callback.on_event(
        {"type": "response.audio_transcript.delta", "delta": "我"}
    )
    bridge._conv.callback.on_event(
        {"type": "response.audio_transcript.delta", "delta": "画了一只猫"}
    )
    bridge._conv.callback.on_event({"type": "response.done"})
    ev = await asyncio.wait_for(bridge.events(), 1)
    assert ev["kind"] == "transcript"
    assert ev["text"] == "我画了一只猫"


async def test_bridge_transcript_buffer_resets_between_responses():
    """After a flush the buffer is cleared so the next response starts fresh."""
    bridge = _make_bridge(instructions="x")
    await bridge.connect()
    bridge._conv.callback.on_event(
        {"type": "response.audio_transcript.delta", "delta": "第一句"}
    )
    bridge._conv.callback.on_event({"type": "response.done"})
    first = await asyncio.wait_for(bridge.events(), 1)
    assert first["text"] == "第一句"

    bridge._conv.callback.on_event(
        {"type": "response.audio_transcript.delta", "delta": "第二句"}
    )
    bridge._conv.callback.on_event({"type": "response.done"})
    second = await asyncio.wait_for(bridge.events(), 1)
    assert second["text"] == "第二句"


async def test_bridge_empty_transcript_does_not_emit():
    """A ``response.done`` with no accumulated deltas must not emit an empty
    transcript event."""
    bridge = _make_bridge(instructions="x")
    await bridge.connect()
    bridge._conv.callback.on_event({"type": "response.done"})
    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(bridge.events(), 0.2)


async def test_bridge_passes_api_key_to_factory():
    """CRITICAL: api_key must be threaded through to the SDK conversation."""
    captured = {}

    def recording_factory(*, model, callback, url, api_key):
        captured["api_key"] = api_key
        return FakeConversation(model, callback, url, api_key=api_key)

    bridge = _make_bridge(
        conversation_factory=recording_factory,
        api_key="sk-test-123",
        instructions="x",
    )
    await bridge.connect()
    assert captured["api_key"] == "sk-test-123"
    assert bridge._conv.api_key == "sk-test-123"


async def test_bridge_defaults_empty_api_key():
    """Default api_key is an empty string when not provided (no crash)."""
    bridge = _make_bridge(instructions="x")
    await bridge.connect()
    assert bridge._conv.api_key == ""


async def test_bridge_close_closes_conversation():
    bridge = _make_bridge(instructions="x")
    await bridge.connect()
    await bridge.close()
    assert bridge._conv.connected is False
