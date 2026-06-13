"""Integration tests for the /ws/realtime WebSocket endpoint (Task 4).

A FakeBridge is injected via monkeypatch so no SDK / network is needed. The test
verifies the upstream relay (audio/image frames reach the bridge) and the
downstream pump (bridge events are pushed to the browser per the protocol).
"""

import asyncio
import base64

from fastapi.testclient import TestClient

from app.main import app
from app.api import realtime


class FakeBridge:
    """Injectable replacement for OmniBridge inside the endpoint."""

    instances = []

    def __init__(self, **kwargs):
        self.kwargs = kwargs
        self.audio = []
        self.images = []
        self.opener_instructions = []
        self.closed = False
        # Pre-seed downstream events to be pumped to the client.
        self._events = [
            {"kind": "transcript", "text": "你好"},
            {"kind": "audio", "data": b"PCMBYTES"},
        ]
        FakeBridge.instances.append(self)

    async def connect(self):
        pass

    async def send_audio(self, pcm):
        self.audio.append(pcm)

    async def send_image(self, jpeg):
        self.images.append(jpeg)

    async def trigger_response(self, instructions=""):
        self.opener_instructions.append(instructions)

    async def events(self):
        if self._events:
            return self._events.pop(0)
        # Block "forever" once drained so the pump task idles instead of busy-looping.
        await asyncio.sleep(3600)

    async def close(self):
        self.closed = True


def test_ws_pushes_transcript_and_audio(monkeypatch):
    FakeBridge.instances.clear()
    monkeypatch.setattr(realtime, "OmniBridge", FakeBridge)
    client = TestClient(app)
    with client.websocket_connect("/ws/realtime") as ws:
        # Upstream: send one audio frame.
        ws.send_json({"type": "audio", "data": base64.b64encode(b"\x00").decode()})
        # Downstream: first seeded event is a transcript.
        msg1 = ws.receive_json()
        assert msg1["type"] == "transcript"
        assert msg1["text"] == "你好"
        # Second seeded event is audio, re-encoded as base64 per the protocol.
        msg2 = ws.receive_json()
        assert msg2["type"] == "audio"
        assert base64.b64decode(msg2["data"]) == b"PCMBYTES"

    # The injected bridge received the uplink audio.
    assert FakeBridge.instances
    bridge = FakeBridge.instances[0]
    assert bridge.audio == [b"\x00"]


def test_ws_passes_api_key_from_config_to_bridge(monkeypatch):
    """CRITICAL: the endpoint must read qwen_omni.api_key from config and pass
    it into the OmniBridge so the SDK can authenticate."""
    FakeBridge.instances.clear()
    monkeypatch.setattr(realtime, "OmniBridge", FakeBridge)
    monkeypatch.setattr(
        realtime,
        "get_config",
        lambda: {"qwen_omni": {"api_key": "sk-from-config", "model": "m", "voice": "Cherry"}},
    )
    client = TestClient(app)
    with client.websocket_connect("/ws/realtime") as ws:
        ws.receive_json()  # drain one downstream event so the bridge is built

    bridge = FakeBridge.instances[0]
    assert bridge.kwargs.get("api_key") == "sk-from-config"


def test_ws_relays_image_frames(monkeypatch):
    FakeBridge.instances.clear()
    monkeypatch.setattr(realtime, "OmniBridge", FakeBridge)
    client = TestClient(app)
    jpeg = b"\xff\xd8\xff"
    with client.websocket_connect("/ws/realtime") as ws:
        ws.send_json({"type": "image", "data": base64.b64encode(jpeg).decode()})
        # Drain a downstream message to ensure the server has processed input.
        ws.receive_json()

    bridge = FakeBridge.instances[0]
    assert bridge.images == [jpeg]
