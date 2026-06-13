<div align="center">

# yz_toybot

### VV — A Vision-Realtime AI Companion Toy for Children

*Point a camera at your child's world. VV sees, and talks back — in real time.*

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?style=flat-square&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)
![Qwen-Omni](https://img.shields.io/badge/Qwen--Omni-Realtime-FF6A00?style=flat-square)
![WebSocket](https://img.shields.io/badge/Realtime-WebSocket-010101?style=flat-square)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white)

![Status](https://img.shields.io/badge/Phase%201-Realtime%20Vision%20MVP-success?style=flat-square)
![Deploy](https://img.shields.io/badge/Deploy-Render-46E3B7?style=flat-square&logo=render&logoColor=white)

**Live demo:** https://yzbot-kevk.onrender.com

</div>

---

## Overview

**yz_toybot** is the vision-realtime upgrade of [kidsBot](https://github.com/SuperGokou/kidsBot).
It keeps VV — a gentle, Montessori-style AI companion for young children — and gives it **eyes**:
a USB webcam or a phone camera streams the child's surroundings to VV, which **watches the scene
and converses by voice in real time**, proactively reacting to the child's face, gestures, and
the world around them.

| Before (kidsBot) | Now (yz_toybot) |
|---|---|
| Voice-only companion | Voice **+ live camera vision** |
| Responds when spoken to | **Proactively** greets and comments on what it sees |
| Google STT + Edge TTS + text LLM pipeline | Single **Qwen-Omni Realtime** multimodal stream |
| — | Sees **facial expressions** and the **background environment** |

---

## Key Capabilities

| Capability | Description |
|---|---|
| Realtime vision | Continuous camera frames (~1.5 fps) streamed to a multimodal model for live scene understanding |
| Any camera | USB webcam or phone camera — both via the browser's `getUserMedia`, front/back selectable |
| Proactive | VV opens the conversation on its own and comments as the scene changes (not just on request) |
| Natural Chinese voice | Speaks fluent Mandarin with a warm, expressive, non-robotic personality |
| Expression-aware | Reacts to the child's smiles, focus, confusion, and gestures |
| Environment-aware | Notices and chats about the room, toys, picture books, and objects in view |
| One realtime stream | Speech-to-text, reasoning, and text-to-speech handled end-to-end by Qwen-Omni Realtime |
| Montessori persona | Respects the child's pace, encourages exploration, favors open-ended questions |

---

## Technical Architecture

```
┌─────────────────── Browser (React) ───────────────────┐
│  getUserMedia: camera + microphone                     │
│   ├─ video → canvas frames ~1.5 fps → JPEG (base64)    │
│   └─ audio → AudioWorklet → PCM16 16 kHz (base64)      │
│            │  WebSocket  (uplink A/V · downlink voice+text)
└────────────┼───────────────────────────────────────────┘
             ▼
┌─────────────────── FastAPI backend ────────────────────┐
│  /ws/realtime  (api/realtime.py)                        │
│   └─ OmniBridge (core/omni_bridge.py)                   │
│        · session: VV persona + voice (instructions)     │
│        · uplink:   append_audio / append_video          │
│        · proactive: create_response (VV opens the talk) │
│        · downlink: assistant audio (PCM16 24 kHz) + text │
└────────────┼───────────────────────────────────────────┘
             ▼  WebSocket
   Alibaba DashScope · Qwen-Omni Realtime (qwen3.5-omni-plus-realtime)
```

The browser captures audio and video and streams both to the FastAPI backend over a single
WebSocket. The backend's `OmniBridge` proxies the stream to **Qwen-Omni Realtime** over its own
WebSocket, keeps the API key server-side, injects VV's persona, and relays the model's voice and
transcript back to the browser. In production the FastAPI app also serves the built frontend, so
`/ws/realtime` is reached same-origin (`wss://`) with no proxy.

### Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Zustand, Web Audio API (AudioWorklet) |
| Backend | FastAPI, Uvicorn, Python 3.11, `websockets` |
| Realtime AI | Qwen-Omni Realtime via DashScope SDK (`dashscope.audio.qwen_omni`) |
| Testing | Vitest + Testing Library (frontend), Pytest (backend), Playwright (E2E) |
| Delivery | Multi-stage Docker, Render |

### Realtime WebSocket Protocol (`/ws/realtime`)

| Direction | Message |
|---|---|
| Browser → backend | `{"type": "audio", "data": "<base64 PCM16 16kHz>"}` |
| Browser → backend | `{"type": "image", "data": "<base64 JPEG>"}` |
| Backend → browser | `{"type": "audio", "data": "<base64 PCM16 24kHz>"}` |
| Backend → browser | `{"type": "transcript", "text": "<assistant text>"}` |

---

## Project Structure

```
yz_toybot/
├── frontend/                     # React + Vite app
│   └── src/
│       ├── hooks/
│       │   ├── useCamera.ts       # getUserMedia, frame grab, front/back camera
│       │   ├── useRealtime.ts     # /ws/realtime client (A/V uplink, voice downlink)
│       │   └── useRealtimeVision.ts  # composes camera + mic + worklet + playback
│       ├── audio/
│       │   ├── pcm.ts             # Float32 → PCM16
│       │   ├── pcm-worklet.js     # mic capture AudioWorklet
│       │   └── playback.ts        # gapless PCM playback (24 kHz)
│       ├── components/CameraView.tsx
│       └── views/ChatView.tsx
├── backend/
│   └── app/
│       ├── api/realtime.py        # /ws/realtime endpoint + proactive opener
│       ├── core/omni_bridge.py    # Qwen-Omni Realtime session bridge
│       ├── prompts/vv_persona.py  # VV Montessori persona / instructions
│       └── config.py              # dict config + env overrides
├── config/config.yaml.example
├── requirements-deploy.txt        # slim runtime deps (no torch/chromadb)
├── Dockerfile                     # multi-stage: build frontend, run backend
├── render.yaml                    # Render Blueprint
└── DEPLOY.md                      # deployment guide
```

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- A DashScope (Qwen) API key — Alibaba Cloud Model Studio

### 1. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows  (source .venv/bin/activate on macOS/Linux)
pip install fastapi "uvicorn[standard]" websockets pydantic python-multipart \
            python-dotenv pyyaml numpy openai dashscope edge-tts SpeechRecognition
```

Create a `.env` in the project root with your key:

```bash
QWEN_API_KEY=sk-your-dashscope-key      # DASHSCOPE_API_KEY also accepted
```

Run it:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173, click **开启摄像头 (Start camera)**, wait ~2 seconds — VV greets you.

> Tip: camera and microphone require a secure context. `localhost` is fine for development;
> any other host needs HTTPS.

---

## Configuration

Configuration is read from `config/config.yaml` (falls back to `config/config.yaml.example`),
and any of the following environment variables override it:

| Variable | Description | Default |
|---|---|---|
| `DASHSCOPE_API_KEY` / `QWEN_API_KEY` | DashScope (Qwen) API key | — (required) |
| `QWEN_OMNI_MODEL` | Realtime model id | `qwen3.5-omni-plus-realtime` |
| `QWEN_OMNI_VOICE` | Voice timbre (see below) | `Serena` |
| `QWEN_OMNI_WS_URL` | DashScope realtime WebSocket endpoint | `wss://dashscope.aliyuncs.com/api-ws/v1/realtime` |

**Supported voices** for `qwen3.5-omni-plus-realtime`:
`Serena`, `Sunny`, `Kiki`, `Tina` (female) · `Ethan`, `Dylan`, `Peter`, `Aiden` (male).

```yaml
# config/config.yaml (gitignored; copy from config.yaml.example)
qwen_omni:
  api_key: ""                 # or set DASHSCOPE_API_KEY / QWEN_API_KEY
  model: "qwen3.5-omni-plus-realtime"
  voice: "Serena"
  ws_url: "wss://dashscope.aliyuncs.com/api-ws/v1/realtime"
  input_sample_rate: 16000
  output_sample_rate: 24000
  vision_fps: 1.5
```

---

## Deployment

A multi-stage `Dockerfile` builds the frontend and serves it together with the backend, and
`render.yaml` describes a one-service Render Blueprint. See **[DEPLOY.md](DEPLOY.md)** for full steps.

```bash
# Local container
docker build -t yz_toybot .
docker run -p 8000:8000 -e DASHSCOPE_API_KEY=sk-your-key yz_toybot
# → http://localhost:8000
```

On Render: **New → Blueprint → pick this repo → Apply**, then set `DASHSCOPE_API_KEY`
(the service runs on Singapore / Docker / health check `/api/status`). Camera and mic work
because Render serves HTTPS automatically.

---

## Roadmap

- **Phase 1 — Realtime Vision (done)**
  - [x] Browser camera + microphone capture (USB / phone)
  - [x] FastAPI `/ws/realtime` bridge to Qwen-Omni Realtime
  - [x] Proactive, Chinese-speaking VV that sees expressions and surroundings
  - [x] Docker + Render deployment
- **Phase 2 — Knowledge & Memory**
  - [ ] RAG context injected per session
  - [ ] Auto-learning memory driven by live transcripts
- **Phase 3 — Product polish**
  - [ ] Parent portal and daily learning reports
  - [ ] Multi-mode teaching (Story / Three-Period Lesson / Game)
  - [ ] WebRTC direct path for lower latency

---

## License

Proprietary. All rights reserved.

<div align="center">

*VV is watching, and it can't wait to say hi.*

</div>
