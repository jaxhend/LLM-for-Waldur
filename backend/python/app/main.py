import json
import logging

from fastapi import  FastAPI, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import StreamingResponse, JSONResponse

from .config import settings
from .schemas import ChatRequest, ChatChunk, ChatResponse
from .services import llm_service
from .services.errors import LLMError

logger = logging.getLogger(__name__)


app = FastAPI(title="Waldur LLM Backend", version="0.1.0", description="Waldur LLM Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Invalid request payload",
            "errors": exc.errors()
        },
    )

@app.exception_handler(LLMError)
async def llm_exception_handler(request: Request, exc: LLMError):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail
        },
    )

@app.exception_handler(Exception)
async def exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error occurred")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"},
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
                    error_payload = {
                        "id": "error",
                        "model": settings.model,
                        "delta": str(e),
                        "done": True
                    }
                    yield f"data: {json.dumps(error_payload)}\n\n"

            return StreamingResponse(
                event_source(),
                media_type="text/event-stream",
                headers= {
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                }
            )
        else:
            out = await llm_service.complete(req)
            response = ChatResponse(**out)
            return JSONResponse(response.model_dump())
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise LLMError(str(e))




