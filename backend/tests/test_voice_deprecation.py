"""Task 10: the old Google STT / Edge TTS live paths are retired.

Qwen-Omni Realtime replaces the live speech-to-text + text-to-speech round-trip,
so ``POST /api/voice/transcribe`` and ``POST /api/tts`` should no longer be
served. The owner voice-print verification (``/api/voice/verify``) is an auth
feature, not a live chat path, and is intentionally kept. Core chat / parent /
memory routes and the new realtime WebSocket must remain available.
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _paths() -> set:
    return {route.path for route in app.routes if hasattr(route, "path")}


def test_old_live_stt_route_retired():
    assert "/api/voice/transcribe" not in _paths()


def test_old_live_tts_route_retired():
    assert "/api/tts" not in _paths()


def test_owner_voice_verify_route_kept():
    # Auth feature, not a live STT/TTS path — kept.
    assert "/api/voice/verify" in _paths()


def test_core_routes_preserved():
    paths = _paths()
    assert "/api/chat" in paths
    assert "/ws/realtime" in paths


def test_app_imports_cleanly():
    # Importing app.main (done at module load) must not raise.
    assert app.title
