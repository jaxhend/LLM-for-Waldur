# LLM for Waldur (Next.js + FastAPI + LangServe + KEDA)

End-to-end LLM chatbot platform with **real-time streaming**, **Redis-backed worker architecture**, and **Kubernetes autoscaling**.  
The system is designed to efficiently handle concurrent LLM requests while optimizing GPU usage.

---

## 🚀 Features

- Real-time LLM streaming (SSE)
- Decoupled API & worker architecture
- Redis-based message queue
- KEDA-driven autoscaling for GPU workers
- CI/CD with GitHub Actions
- Kubernetes-ready deployment
- Mermaid diagram support in frontend

---

## 🧩 Architecture Overview
```text
Frontend (Next.js)
   ↓
LangServe Backend (FastAPI)
   ↓
Redis Queue
   ↓
KEDA Autoscaler
   ↓
Ollama Worker Pods (GPU)
   ↓
LangServe Backend
   ↓
Frontend (Streaming)
```


---

## 🖥️ Frontend

### Stack
- **Framework:** Next.js
- **Language:** TypeScript
- **UI:** [assistant-ui](https://www.assistant-ui.com/)
- **Diagrams:** Mermaid

### LLM Streaming
The frontend uses a **custom LocalRuntime provider** via `CustomRuntimeProvider.tsx` to enable **real-time chatbot responses** directly from the backend.

- Uses assistant-ui `LocalRuntime`
- Streams responses from `/api/lc/chat/stream`
- Docs: https://www.assistant-ui.com/docs/runtimes/custom/local

---

## ⚙️ Backend

### Stack
- Python
- FastAPI
- Uvicorn
- LangChain + LangServe
- Redis
- Structlog

### Core Components
- **Entrypoint:** `app/main.py`
- **LangServe endpoint:** `/api/lc/chat`
- **Chains:** `app/chains/chat.py`
  - Wrap `ChatOllama`
  - Model selection based on `NODE_ENV`

### Middleware
- CORS
- Request context (request ID, metadata)
- Shared Redis connection (caching + pub/sub)

### Exception Handling
- `422` – validation errors (structured JSON)
- `500` – unhandled exceptions (structured JSON + stack trace)

---

## 🔄 LangServe Request Flow

1. Frontend sends request to:
   - `/api/lc/chat/invoke`
   - `/api/lc/chat/stream`
2. LangServe enqueues task in Redis
3. Redis assigns task to worker
4. Ollama worker processes request
5. Result is published back to Redis
6. Backend returns:
   - JSON (invoke)
   - SSE stream (stream)

---

## 📊 Logging

- Structured JSON logs using **structlog**
- Includes:
  - timestamp
  - level
  - event
  - request_id
  - path
- Stack traces included for errors
- Logs to `stdout` (Kubernetes-friendly)

---

## ❤️ Health Check
```text
GET /api/health
```

---

## 📦 Deployment

### CI/CD – GitHub Actions

Workflow: `.github/workflows/build-and-deploy.yaml`

- Triggered on:
  - Push to `main`
  - Manual dispatch
- Path-based filtering:
  - `backend/`
  - `frontend/`
  - `deploy/k8s/`

Only affected components are rebuilt and redeployed.

---

### 🐳 Docker

- Separate images for:
  - Backend
  - Frontend
  - Ollama Worker
- Images tagged with:
  - Commit SHA
  - `latest`
- Registry: **GitHub Container Registry (GHCR)**
- Docker layer caching enabled

---

### ☸️ Kubernetes

- Rolling restart after image push
- `kubectl apply` for manifest changes
- Declarative deployment via `deploy/k8s/`

---

## 📈 KEDA Autoscaling

### Purpose
Dynamically scale Ollama worker pods based on Redis queue length.

### How it works
- API enqueues LLM requests into Redis
- KEDA monitors queue depth
- Worker pods scale up/down automatically
- Each worker:
  - Uses 1 GPU
  - Processes 1 request at a time
  - Streams output back to backend

### Benefits
- Concurrent LLM request handling
- Efficient GPU utilization
- Workers only run when needed
- Preserves LangServe features (streaming, rate limits, token tracking)

---

## 🔐 Required Secrets

- `GHCR_TOKEN` – GitHub Container Registry access
- `KUBECONFIG_CONTENT` – Kubernetes service account config

---

## 🧪 Local Development

### Backend
```bash
cd repo/backend
python -m uv sync
python -m uv run uvicorn app.main:app --reload --port 8000
```

### Redis
```bash
redis-server
```

### Ollama worker
```bash
cd ollama_worker
python ollama_worker.py
```

### LLM
```bash
ollama serve
```

### Frontend
```bash
cd repo/frontend
npm install -g yarn
yarn install
yarn run dev
```




