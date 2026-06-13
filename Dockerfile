# VV bot — kidsBot vision realtime upgrade. Multi-stage:
#   1) build the React/Vite frontend
#   2) run the FastAPI backend (which also serves the built frontend)

# ---- Stage 1: build frontend -------------------------------------------------
FROM node:20-slim AS frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: backend runtime ------------------------------------------------
FROM python:3.11-slim AS runtime
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Python deps (slim — no torch/chromadb; RAG degrades gracefully).
COPY requirements-deploy.txt ./
RUN pip install --no-cache-dir -r requirements-deploy.txt

# App code + config + built frontend.
COPY backend/ ./backend/
COPY config/ ./config/
COPY --from=frontend /app/frontend/dist ./frontend/dist

# main.py resolves FRONTEND_DIR to /app/frontend/dist and CONFIG_DIR to /app/config.
WORKDIR /app/backend

# Render injects $PORT; default to 8000 for local `docker run`.
ENV PORT=8000
EXPOSE 8000
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
