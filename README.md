<div align="center">

# yz_toybot

### VV —— 会"看"会"聊"的儿童 AI 伴侣

*把摄像头对准孩子的世界,VV 实时看见,并开口陪他说话。*

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109-009688?style=flat-square&logo=fastapi&logoColor=white)
![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)
![Qwen-Omni](https://img.shields.io/badge/Qwen--Omni-Realtime-FF6A00?style=flat-square)
![WebSocket](https://img.shields.io/badge/实时-WebSocket-010101?style=flat-square)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white)

![Status](https://img.shields.io/badge/Phase%201-实时视觉对话%20MVP-success?style=flat-square)
![Deploy](https://img.shields.io/badge/部署-Render-46E3B7?style=flat-square&logo=render&logoColor=white)

**在线演示:** https://yzbot-kevk.onrender.com

</div>

---

## 目录

- [项目简介](#项目简介)
- [它能做什么](#它能做什么)
- [系统架构](#系统架构)
- [工作原理（逐环节拆解）](#工作原理逐环节拆解)
- [技术栈](#技术栈)
- [实时通信协议](#实时通信协议)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [配置说明](#配置说明)
- [部署](#部署)
- [落地到毛绒玩具（硬件方案）](#落地到毛绒玩具硬件方案)
- [后期发展路线](#后期发展路线)
- [隐私与安全](#隐私与安全)
- [许可证](#许可证)

---

## 项目简介

**yz_toybot** 是 [kidsBot](https://github.com/SuperGokou/kidsBot) 的**视觉实时升级版**。

它保留了 VV —— 一个温柔、耐心、遵循蒙特梭利理念的儿童 AI 伴侣 —— 并给它装上了**眼睛**:
一个 USB 摄像头或手机摄像头,把孩子周围的画面实时传给 VV;VV **一边看画面,一边用语音和孩子聊天**,
主动回应孩子的表情、动作和身边的世界。

| 之前(kidsBot) | 现在(yz_toybot) |
|---|---|
| 纯语音陪伴 | 语音 **+ 实时摄像头视觉** |
| 被问到才回答 | **主动**打招呼、主动评论看到的东西 |
| Google STT + Edge TTS + 文本大模型 拼接 | 单一 **Qwen-Omni 实时多模态**流 |
| —— | 能看到**表情**,也能看到**背景环境** |

> 一句话:把"语音玩具"升级成"**能看见的玩伴**"。

---

## 它能做什么

| 能力 | 说明 |
|---|---|
| 实时视觉 | 摄像头连续抽帧(~1.5 fps)送入多模态模型,实时理解画面场景 |
| 任意摄像头 | USB 摄像头或手机摄像头,统一走浏览器 `getUserMedia`,前/后置可切换 |
| 主动开口 | VV 会自己先打招呼,并随画面变化主动评论,而不是干等被问 |
| 自然中文 | 标准普通话,有感情、有个性、不机械的语气 |
| 懂表情 | 回应孩子的微笑、专注、疑惑、动作 |
| 懂环境 | 留意并聊起房间、玩具、绘本、桌上的物品 |
| 一条龙语音 | 语音识别 + 推理 + 语音合成,全部由 Qwen-Omni Realtime 端到端完成 |
| 蒙特梭利人设 | 尊重孩子节奏、鼓励自主探索、多用开放式提问 |

---

## 系统架构

采用**后端代理**架构:浏览器(或硬件设备)采集音视频 → 经一条 WebSocket 上行到自建 FastAPI 后端
→ 后端再用一条 WebSocket 桥接到阿里云 DashScope 的 Qwen-Omni Realtime → 模型返回的语音和文字下行回客户端。

```
┌─────────────────── 客户端:浏览器 / 硬件玩具 ───────────────────┐
│  采集:摄像头 + 麦克风                                           │
│   ├─ 视频 → canvas 抽帧 ~1.5 fps → JPEG(base64)                │
│   └─ 音频 → AudioWorklet → PCM16 16kHz(base64)                 │
│            │   一条 WebSocket(上行音视频 · 下行语音+文字)        │
└────────────┼─────────────────────────────────────────────────────┘
             ▼
┌─────────────────── FastAPI 后端 ────────────────────────────────┐
│  /ws/realtime  (api/realtime.py)                                 │
│   └─ OmniBridge (core/omni_bridge.py)                            │
│        · 会话建立:注入 VV 人设 + 音色(instructions/voice)     │
│        · 上行:append_audio / append_video                       │
│        · 主动:create_response(让 VV 先开口)                   │
│        · 下行:模型语音 PCM16 24kHz + 文字转写                   │
│        · API Key 只留在后端,绝不下发客户端                      │
└────────────┼─────────────────────────────────────────────────────┘
             ▼  WebSocket
     阿里云 DashScope · Qwen-Omni Realtime(qwen3.5-omni-plus-realtime)
```

**为什么是后端代理(而不是客户端直连模型)?**

1. **密钥安全** —— DashScope API Key 只存在服务端,永不暴露给浏览器或玩具固件。
2. **可插业务** —— 后端能在会话里注入 RAG 知识 / 孩子的记忆画像,并截获对话文字用于家长报告(Phase 2/3)。
3. **设备无关** —— `/ws/realtime` 是一套**与客户端无关的协议**;浏览器只是其中一种客户端,换成毛绒玩具里的嵌入式设备同样能接(见[落地到毛绒玩具](#落地到毛绒玩具硬件方案))。
4. 生产环境后端同时托管打包好的前端,`/ws/realtime` 走**同源** `wss://`,无需任何代理。

---

## 工作原理(逐环节拆解)

### 1) 视觉:连续抽帧而非视频流
人脸表情和场景理解不需要 30fps。客户端用 `canvas.drawImage` 从视频里**每 ~0.66 秒抓一帧**,
压成 JPEG(质量 0.6)再 base64 上行。**1~2 fps** 既保留"实时跟着画面走"的体感,又把带宽和 token 成本压到很低。
帧率由 `vision_fps` 配置。

### 2) 听觉:浏览器音频 → PCM16 管线
麦克风音频经 Web Audio 的 **AudioWorklet** 取出 Float32 采样,转成**小端 16-bit PCM、16kHz 单声道**
(`floatTo16BitPCM`),分块 base64 上行。这是 Qwen-Omni 实时接口要求的输入格式。

### 3) 传输:一条 WebSocket 复用上下行
上行 JSON 文本帧 `{"type":"audio|image","data":<base64>}`;下行 `{"type":"audio",...}` / `{"type":"transcript",...}`。
单连接双向复用,简单稳健。

### 4) 大脑:Qwen-Omni Realtime 一条龙
后端 `OmniBridge` 用 DashScope SDK(`OmniRealtimeConversation`)把音视频流转发给模型。模型**同时**理解
流式音频与图像帧,**实时输出语音 + 文字**,即把"语音识别 → 大模型推理 → 语音合成"三步合并成一个流式管线,
延迟远低于传统拼接方案。SDK 回调跑在独立线程,通过 `loop.call_soon_threadsafe` 安全地投递回 asyncio 队列。

### 5) 轮次:服务端 VAD 自动应答
会话开启 `server_vad`(语音活动检测):孩子说话 → 服务端自动判定一句话结束 → 自动生成回应。
客户端无需手动"按住说话"。

### 6) 主动:开摄像头就先开口
收到第一帧画面 ~2 秒后,后端调用 `create_response`,带上"主动打招呼、说说你看到了什么"的指令,
让 VV **先开口**并评论当前画面——这就是"主动"的来源,而不是干等孩子先说话。

### 7) 回声:转写回流 + 语音播放
模型的文字转写以 `response.audio_transcript.delta` 增量到来,在 `...done` / `response.done` 时拼成整句下发上屏;
语音以 PCM16 24kHz 分块下发,客户端用 `nextPlayTime` 游标**无缝排程播放**,避免多块重叠爆音。

### 8) 人设:一切个性来自 instructions
VV 的中文、活泼语气、看表情、聊背景、蒙特梭利原则,全部写在会话建立时注入的 **system instructions**
(`vv_persona.py`)里。换语气、换风格只改这里。

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React 18 · TypeScript · Vite · Tailwind CSS · Zustand · Web Audio API(AudioWorklet) |
| 后端 | FastAPI · Uvicorn · Python 3.11 · `websockets` |
| 实时 AI | Qwen-Omni Realtime · DashScope SDK(`dashscope.audio.qwen_omni`) |
| 测试 | Vitest + Testing Library(前端)· Pytest(后端)· Playwright(E2E) |
| 交付 | 多阶段 Docker · Render |

---

## 实时通信协议

`/ws/realtime`(JSON 文本帧):

| 方向 | 消息 |
|---|---|
| 客户端 → 后端 | `{"type": "audio", "data": "<base64 PCM16 16kHz>"}` |
| 客户端 → 后端 | `{"type": "image", "data": "<base64 JPEG>"}` |
| 后端 → 客户端 | `{"type": "audio", "data": "<base64 PCM16 24kHz>"}` |
| 后端 → 客户端 | `{"type": "transcript", "text": "<VV 的文字>"}` |

> 这套协议**与客户端无关**:浏览器、手机网页、树莓派玩具,谁实现了它谁就能接入。

---

## 项目结构

```
yz_toybot/
├── frontend/                        # React + Vite 前端
│   └── src/
│       ├── hooks/
│       │   ├── useCamera.ts          # getUserMedia、抽帧、前后置切换
│       │   ├── useRealtime.ts        # /ws/realtime 客户端(音视频上行、语音下行)
│       │   └── useRealtimeVision.ts  # 组合 摄像头+麦克风+worklet+播放
│       ├── audio/
│       │   ├── pcm.ts                # Float32 → PCM16
│       │   ├── pcm-worklet.js        # 麦克风采集 AudioWorklet
│       │   └── playback.ts           # 24kHz PCM 无缝播放
│       ├── components/CameraView.tsx
│       └── views/ChatView.tsx
├── backend/
│   └── app/
│       ├── api/realtime.py           # /ws/realtime 端点 + 主动开场
│       ├── core/omni_bridge.py       # Qwen-Omni 实时会话桥接
│       ├── prompts/vv_persona.py     # VV 蒙特梭利人设 / instructions
│       └── config.py                 # 字典式配置 + 环境变量覆盖
├── config/config.yaml.example
├── requirements-deploy.txt           # 精简运行依赖(无 torch/chromadb)
├── Dockerfile                        # 多阶段:构建前端 + 运行后端
├── render.yaml                       # Render 蓝图
└── DEPLOY.md                         # 部署指南
```

---

## 快速开始

### 前置

- Python 3.11+ · Node.js 18+
- 一个 DashScope(通义千问)API Key —— 阿里云百炼平台

### 1. 后端

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows(macOS/Linux 用 source .venv/bin/activate)
pip install fastapi "uvicorn[standard]" websockets pydantic python-multipart \
            python-dotenv pyyaml numpy openai dashscope edge-tts SpeechRecognition
```

在项目根目录建 `.env`:

```bash
QWEN_API_KEY=sk-你的key       # 也接受 DASHSCOPE_API_KEY
```

启动:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 2. 前端

```bash
cd frontend
npm install
npm run dev
```

浏览器打开 http://localhost:5173,点 **开启摄像头**,等约 2 秒,VV 主动跟你说话。

> 摄像头/麦克风需要安全上下文:`localhost` 开发可用;其它域名需 HTTPS。

---

## 配置说明

配置读取 `config/config.yaml`(不存在则回退 `config/config.yaml.example`),以下环境变量可覆盖:

| 变量 | 说明 | 默认 |
|---|---|---|
| `DASHSCOPE_API_KEY` / `QWEN_API_KEY` | DashScope(通义千问)API Key | —(必填) |
| `QWEN_OMNI_MODEL` | 实时模型 id | `qwen3.5-omni-plus-realtime` |
| `QWEN_OMNI_VOICE` | 音色(见下) | `Serena` |
| `QWEN_OMNI_WS_URL` | DashScope 实时 WebSocket 端点 | `wss://dashscope.aliyuncs.com/api-ws/v1/realtime` |

`qwen3.5-omni-plus-realtime` **有效音色**:
`Serena`、`Sunny`、`Kiki`、`Tina`(女声) · `Ethan`、`Dylan`、`Peter`、`Aiden`(男声)。

---

## 部署

多阶段 `Dockerfile` 构建前端并与后端一起托管,`render.yaml` 描述一个单服务的 Render 蓝图。完整步骤见 **[DEPLOY.md](DEPLOY.md)**。

```bash
# 本地容器
docker build -t yz_toybot .
docker run -p 8000:8000 -e DASHSCOPE_API_KEY=sk-你的key yz_toybot
# → http://localhost:8000
```

Render 上:**New → Blueprint → 选本仓库 → Apply**,然后填 `DASHSCOPE_API_KEY`
(服务跑在 Singapore / Docker / 健康检查 `/api/status`)。Render 自带 HTTPS,摄像头/麦克风可用。

---

## 落地到毛绒玩具(硬件方案)

这是 yz_toybot 的终极形态:把"网页里的 VV"塞进一只**会看会聊的毛绒玩具**。

### 核心思路:玩具只是"又一个客户端"

后端的 `/ws/realtime` 是**设备无关**的协议。浏览器做的事——采集 PCM16 音频 + JPEG 帧上行、播放返回的语音——
换成玩具里的一块嵌入式板子来做即可,**后端和大模型一行都不用改**。

```
[ 毛绒玩具 ]  摄像头+麦克风 → 嵌入式客户端 ──WiFi/WebSocket──▶ 你的 FastAPI 后端 ──▶ Qwen-Omni Realtime
   扬声器 ◀──────────────────  语音下行  ──────────────────────────┘
```

### 硬件选型(参考)

| 部件 | 推荐 | 说明 |
|---|---|---|
| 主控/算力 | 树莓派 Zero 2 W / 4 / 5 | 跑 Python 客户端、WiFi、音视频编解码;成本/功耗折中选 Zero 2 W |
| 摄像头 | 树莓派 Camera Module 3 或小型 USB 摄像头 | 藏在玩具的**眼睛/额头**,广角更好 |
| 麦克风 | I2S MEMS 麦 或 ReSpeaker 麦克风阵列 | 阵列带**远场拾音 + 降噪**,孩子隔半米说话也清楚 |
| 扬声器 | I2S 功放(如 MAX98357A)+ 小喇叭 | 放玩具**肚子/胸口**,出 VV 的声音 |
| 交互 | 按钮(藏在肚子)+ WS2812 LED("眼睛") | 按一下开始对话;LED 表示"在看/在想/在说" |
| 电源 | 锂电 + 电源管理(如 PiSugar) | 便携、可充电 |
| 网络 | 板载 WiFi | 连家里路由器 |

> 更低成本可探索 **ESP32-S3**(带摄像头+I2S),但实时多模态串流较吃力,首选树莓派类 SBC。

### 嵌入式客户端要做的事(复用同一协议)

一段 ~100 行的 Python 客户端就能让玩具接入(伪代码):

```python
# 玩具固件:采集 → 上行 → 播放,协议与网页版完全一致
ws = connect("wss://你的后端/ws/realtime")
start_mic(rate=16000)            # I2S 麦 → PCM16 16kHz
start_camera()                   # 摄像头模块
loop:
    pcm = read_mic_chunk()
    ws.send_json{"type":"audio","data": b64(pcm)}
    every ~0.66s:
        jpeg = capture_frame()   # 抽一帧
        ws.send_json{"type":"image","data": b64(jpeg)}
    on ws message:
        if audio: play_to_speaker(pcm24k)   # I2S 功放
        if transcript: log/灯效
```

### 玩具形态与体感设计

- **眼睛 = 摄像头**:孩子直觉地"看着它的眼睛说话",画面正好对准脸和身前的玩具。
- **肚子 = 按钮/扬声器**:抱一下、按一下肚子开始聊天;声音从胸腹传出更像"它在说话"。
- **LED 眼神**:呼吸灯(待命)→ 亮起(在看)→ 闪烁(在想)→ 柔和常亮(在说),给孩子清晰反馈。
- **唤醒**:按钮触发,或后续加**离线唤醒词**("VV~")避免一直联网拾音。

### 两种部署拓扑

1. **设备 → 自建后端 → DashScope(推荐)**:密钥在后端、可插记忆/家长报告、可控可审计。
2. **设备直连 DashScope(WebRTC/WebSocket)**:延迟最低、内置回声消除,但密钥要走**临时 token**、业务逻辑只能旁路。量产追求极致体验时再上。

### 量产要考虑的

延迟优化(就近区域 + WebRTC)、离线唤醒词、断网兜底话术、功耗与续航、儿童隐私合规(摄像头指示灯、家长开关、数据最小化)、声学结构(麦克风远离喇叭防啸叫)。

---

## 后期发展路线

- **Phase 1 — 实时视觉对话(已完成)**
  - [x] 浏览器摄像头 + 麦克风采集(USB / 手机)
  - [x] FastAPI `/ws/realtime` 桥接 Qwen-Omni Realtime
  - [x] 主动、说中文、能看表情和环境的 VV
  - [x] Docker + Render 部署
- **Phase 2 — 知识与记忆**
  - [ ] 会话级注入 RAG 知识
  - [ ] 由实时转写驱动的"自动学习"长期记忆(记住每个孩子)
- **Phase 3 — 产品化**
  - [ ] 家长端 + 每日学习报告
  - [ ] 多模式教学(故事 / 三段式教学 / 游戏)
  - [ ] WebRTC 直连低延迟路径
- **Phase 4 — 硬件 / 毛绒玩具**
  - [ ] 树莓派参考客户端 + 麦克风阵列 + I2S 扬声器
  - [ ] 离线唤醒词、LED 眼神、按键交互
  - [ ] 续航、声学与外观结构、儿童隐私合规
  - [ ] 量产 BOM 与成本优化

---

## 隐私与安全

- API Key 只存后端环境变量,**不进仓库、不下发客户端**(`.env`、`config.yaml` 均已 gitignore)。
- 面向儿童:摄像头应有**物理/可见指示灯**、**家长开关**、数据最小化;落地硬件需遵循当地儿童个人信息保护法规。
- 实时音视频默认不落盘;如需记忆/报告,应明确告知并由家长授权。

---

## 许可证

Proprietary. 保留所有权利。

<div align="center">

*VV 正看着你,迫不及待想说"你好呀~"。*

</div>
