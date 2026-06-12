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

    def __init__(self, model, callback, url):
        self.model = model
        self.callback = callback
        self.url = url
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


async def test_bridge_emits_audio_and_transcript_events():
    bridge = _make_bridge(instructions="x")
    await bridge.connect()
    # Simulate SDK pushing events on its own thread. on_event takes a single dict.
    bridge._conv.callback.on_event(
        {"type": "response.audio.delta", "delta": base64.b64encode(b"PCM").decode()}
    )
    bridge._conv.callback.on_event(
        {"type": "response.audio_transcript.done", "transcript": "你好小明"}
    )
    out1 = await asyncio.wait_for(bridge.events(), 1)
    out2 = await asyncio.wait_for(bridge.events(), 1)
    by_kind = {out1["kind"]: out1, out2["kind"]: out2}
    assert "audio" in by_kind and "transcript" in by_kind
    assert by_kind["audio"]["data"] == b"PCM"
    assert by_kind["transcript"]["text"] == "你好小明"


async def test_bridge_emits_user_transcription_event():
    bridge = _make_bridge(instructions="x")
    await bridge.connect()
    bridge._conv.callback.on_event(
        {
            "type": "conversation.item.input_audio_transcription.completed",
            "transcript": "我画了一只猫",
        }
    )
    ev = await asyncio.wait_for(bridge.events(), 1)
    assert ev["kind"] == "user_transcript"
    assert ev["text"] == "我画了一只猫"


async def test_bridge_close_closes_conversation():
    bridge = _make_bridge(instructions="x")
    await bridge.connect()
    await bridge.close()
    assert bridge._conv.connected is False
