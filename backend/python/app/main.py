import json

from fastapi import HTTPException, FastAPI
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import StreamingResponse, JSONResponse

from .config import settings
from .schemas import ChatRequest, ChatChunk, ChatResponse
from .services import llm_service

app = FastAPI(title="Waldur LLM Backend", version="0.1.0", description="Waldur LLM Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
async def health():
    return {"status": "ok",
            "provider": settings.default_provider,
            "model": settings.model,}

@app.post("/api/v1/chat")
async def chat(req: ChatRequest):
    try:
        if req.stream:
            async def event_source():
                try:
                    async for ch in llm_service.astream(req):
                        yield f"data: {json.dumps(ChatChunk(**ch).model_dump())}\n\n"
                except Exception as e:
                    error_payload = {"id": "error", "model": settings.model, "delta": str(e), "done": True}
                    yield f"data: {json.dumps(error_payload)}\n\n"
            return StreamingResponse(event_source(), media_type="text/event-stream", headers= {
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            })
        else:
            out = await llm_service.complete(req)
            response = ChatResponse(**out)
            return JSONResponse(response.model_dump())
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM provider error: {e}")




