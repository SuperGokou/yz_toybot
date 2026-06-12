"""/ws/realtime — bridges a browser realtime session to Qwen-Omni.

Protocol (JSON text frames)
---------------------------
Browser -> backend:
- ``{"type": "audio", "data": "<base64 PCM16 16kHz mono>"}``
- ``{"type": "image", "data": "<base64 JPEG>"}``

Backend -> browser:
- ``{"type": "audio", "data": "<base64 PCM16 24kHz mono>"}``
- ``{"type": "transcript", "text": "<assistant text>"}``

The endpoint owns one ``OmniBridge`` per connection: a downstream pump task
forwards bridge events to the browser while the main loop relays uplink frames.
``OmniBridge`` is referenced at module level so tests can monkeypatch it.
"""

import asyncio
import base64
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.config import get_config
from app.core.omni_bridge import OmniBridge
from app.prompts.vv_persona import build_instructions

logger = logging.getLogger(__name__)

router = APIRouter()


def _qwen_omni_config() -> dict:
    """Read the qwen_omni config section with safe fallbacks."""
    cfg = get_config() or {}
    return cfg.get("qwen_omni", {}) or {}


@router.websocket("/ws/realtime")
async def realtime_ws(ws: WebSocket):
    await ws.accept()

    qo = _qwen_omni_config()
    bridge = OmniBridge(
        model=qo.get("model", "qwen3.5-omni-plus-realtime"),
        url=qo.get("ws_url", "wss://dashscope.aliyuncs.com/api-ws/v1/realtime"),
        voice=qo.get("voice", "Cherry"),
        instructions=build_instructions(),
        api_key=qo.get("api_key", ""),
    )
    await bridge.connect()

    async def pump_downstream():
        """Forward normalized bridge events to the browser."""
        try:
            while True:
                event = await bridge.events()
                kind = event.get("kind")
                if kind == "audio":
                    await ws.send_json(
                        {
                            "type": "audio",
                            "data": base64.b64encode(event["data"]).decode(),
                        }
                    )
                elif kind == "transcript":
                    await ws.send_json({"type": "transcript", "text": event["text"]})
                elif kind == "user_transcript":
                    # Surface the child's own speech transcription too.
                    await ws.send_json(
                        {"type": "user_transcript", "text": event["text"]}
                    )
                elif kind == "close":
                    break
        except asyncio.CancelledError:
            raise
        except Exception:  # pragma: no cover - defensive
            logger.exception("Realtime downstream pump error")

    down_task = asyncio.create_task(pump_downstream())
    try:
        while True:
            msg = await ws.receive_json()
            msg_type = msg.get("type")
            data = msg.get("data")
            if not data:
                continue
            if msg_type == "audio":
                await bridge.send_audio(base64.b64decode(data))
            elif msg_type == "image":
                await bridge.send_image(base64.b64decode(data))
    except WebSocketDisconnect:
        pass
    except Exception:  # pragma: no cover - defensive
        logger.exception("Realtime upstream loop error")
    finally:
        down_task.cancel()
        try:
            await down_task
        except (asyncio.CancelledError, Exception):
            pass
        await bridge.close()
