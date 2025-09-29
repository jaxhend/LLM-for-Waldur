import logging

import structlog


def setup_logging():
    logging.basicConfig(level=logging.INFO, format="%(message)s")

    for name in ("uvicorn", "uvicorn.error", "uvicorn.access", "gunicorn.error", "gunicorn.access"):
        logger = logging.getLogger(name)
        logger.handlers.clear()
        logger.propagate = True

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,  # request-scoped context from middleware
            structlog.stdlib.add_log_level,  # adds "level"
            structlog.processors.StackInfoRenderer(),  # stack info if asked
            structlog.processors.format_exc_info,  # pretty exc info on logger.exception(...)
            structlog.processors.TimeStamper(fmt="iso"),  # "timestamp"
            structlog.processors.JSONRenderer(),  # final JSON
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        cache_logger_on_first_use=True,
    )
    structlog.get_logger().info("logging initialized")
