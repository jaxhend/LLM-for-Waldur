import structlog
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from langserve import add_routes
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

from .chains.chat import build_chat_chain
from .config import settings
from .redis.redis_conn import get_redis
from .services.logging import setup_logging
from .services.request_context import RequestContextMiddleware

setup_logging()
logger = structlog.get_logger()

app = FastAPI(title="Waldur LLM Backend", version="0.1.0", description="Waldur LLM Backend")


@app.on_event("startup")
async def startup_event():
    logger.info("app.startup", env=settings.env)


origins = [
    "https://llm.testing.waldur.com/",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]

if settings.env != "production":
    origins.append("http://localhost:3000")
    origins.append("http://127.0.0.1:3000")

app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning("request.validation_error", status_code=422, errors=exc.errors())
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Invalid request payload",
            "errors": exc.errors()
        },
    )


@app.exception_handler(Exception)
async def exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error occurred", status_code=500)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"},
    )


@app.get("/api/health")
async def health_check():
    """
    Lightweight health check endpoint.
    Verifies Redis connectivity and returns basic status info.
    """
    try:
        r = get_redis()
        pong = await r.ping()
        await r.aclose()
        redis_ok = pong is True
    except Exception as e:
        redis_ok = False
        logger.warning("health.redis_unavailable", error=str(e))

    return {
        "status": "ok" if redis_ok else "degraded",
        "redis": redis_ok,
        "env": settings.env,
        "model": settings.ollama_model,
    }

# LangServe routes:
chain = build_chat_chain()
add_routes(app, chain, path="/api/lc/chat")
