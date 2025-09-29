import logging
from fastapi import  FastAPI, Request
from fastapi.exceptions import RequestValidationError
from langserve import add_routes
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse
from .chains.chat import build_chat_chain
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



# LangServe routes:
chain = build_chat_chain()
add_routes(app, chain, path="/api/lc/chat")




