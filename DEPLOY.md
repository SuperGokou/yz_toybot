# 部署到 Render

yzbot 用一个 **Docker Web Service** 部署:容器里先构建 React 前端,再由 FastAPI 同源
提供前端静态文件 + `/api/*` + `/ws/realtime`(摄像头/麦克风需要 HTTPS,Render 的
`*.onrender.com` 默认带 HTTPS)。

## 一、前置

- 代码已推送到 GitHub:`https://github.com/SuperGokou/yz_bot`(main 分支)
- 你的 **通义千问 / DashScope API Key**(就是本地 `.env` 里的 `QWEN_API_KEY`)
- 一个 Render 账号(免费)

## 二、用 Blueprint 一键部署(推荐)

1. 登录 https://dashboard.render.com → **New +** → **Blueprint**。
2. 连接并选择仓库 `SuperGokou/yz_bot`。Render 会读取根目录的 `render.yaml`,
   识别出一个名为 `yzbot` 的 Docker 服务。
3. 点 **Apply**。Render 开始构建(多阶段 Docker:Node 构建前端 → Python 跑后端)。
4. 构建完成前/后,进入服务的 **Environment**,把密钥填上:
   - `DASHSCOPE_API_KEY` = 你的 DashScope key(`render.yaml` 里标了 `sync:false`,**不会进 git**)
   - (可选)`QWEN_OMNI_VOICE`:默认 `Serena`。有效音色:`Serena/Sunny/Kiki/Tina`(女)、`Ethan/Dylan/Peter/Aiden`(男)
   - (可选)`QWEN_OMNI_WS_URL`:切换 DashScope 区域端点(默认北京 `wss://dashscope.aliyuncs.com/api-ws/v1/realtime`)
5. 保存后服务会重新部署。健康检查路径是 `/api/status`,返回 200 即就绪。
6. 打开分配的 `https://yzbot-xxxx.onrender.com`,点「开启摄像头」,等 2 秒,VV 主动开口。

## 三、手动创建(不想用 Blueprint)

New + → **Web Service** → 选仓库 → Runtime 选 **Docker** → Region 选 **Singapore** →
Plan 选 **Free** → Health Check Path 填 `/api/status` → 加环境变量 `DASHSCOPE_API_KEY`。

## 四、注意事项

- **免费版会休眠**:闲置 ~15 分钟后服务休眠,下次访问冷启动约 30~60 秒。演示前先打开预热。
- **WebSocket**:Render 各档(含 Free)都支持 WS,`/ws/realtime` 正常工作。
- **DashScope 区域延迟**:你的 key 若是北京区,Render 选 Singapore 跨区访问延迟可接受;
  若你有新加坡区 key,可把 `QWEN_OMNI_WS_URL` 改为 `wss://dashscope-intl.aliyuncs.com/api-ws/v1/realtime`
  并用对应区域的 key,延迟更低。
- **内存**:本部署用精简依赖(不含 torch/chromadb),适配 Free 档 512MB;RAG 记忆为
  Phase 2 功能,启动时优雅降级(日志里 `Memory manager failed: No module named 'chromadb'` 属预期)。
- **密钥安全**:key 只存在 Render 环境变量里,不在仓库中(`config/config.yaml` 与 `.env` 都已 gitignore)。

## 五、本地用 Docker 跑(可选自测)

```bash
docker build -t yzbot .
docker run -p 8000:8000 -e DASHSCOPE_API_KEY=你的key yzbot
# 打开 http://localhost:8000
```
