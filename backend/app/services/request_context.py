import time, uuid, structlog
from starlette.middleware.base import BaseHTTPMiddleware

logger = structlog.get_logger()

class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=str(uuid.uuid4()),
            path=request.url.path,
            method=request.method,
        )
        response = await call_next(request)
        return response