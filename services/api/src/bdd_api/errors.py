"""Consistent error envelope, request ids and structured logging.

Every error response has the shape::

    {"error": {"code": "<machine_code>", "message": "<human text>",
               "request_id": "<id>"}}

Internal exception details are logged, never leaked to clients.
"""

from __future__ import annotations

import json
import logging
import sys
import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("bdd")


class AppError(Exception):
    """Application error carrying a stable machine code + HTTP status."""

    def __init__(self, status_code: int, code: str, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message


class NotFoundError(AppError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(404, code, message)


class ConflictError(AppError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(409, code, message)


class ValidationError(AppError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(422, code, message)


def _error_payload(code: str, message: str, request_id: str) -> dict:
    return {"error": {"code": code, "message": message, "request_id": request_id}}


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Attach X-Request-Id to every request/response and log access lines."""
    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[JSONResponse]]) -> JSONResponse:
        request_id = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-Id"] = request_id
        logger.info(
            json.dumps({"event": "http", "method": request.method, "path": request.url.path, "status": response.status_code, "request_id": request_id})
        )
        return response


_OPEN_PATHS = {"/health", "/health/ready", "/docs", "/openapi.json", "/redoc"}


class ApiKeyMiddleware(BaseHTTPMiddleware):
    """Optional shared-key gate. Inactive when no key is configured.

    When ``BDD_API_KEY`` is set, every route except health/docs needs a
    matching ``X-API-Key`` header. Default (unset) keeps current behavior.
    """

    def __init__(self, app: FastAPI, api_key: str | None) -> None:
        super().__init__(app)
        self._api_key = (api_key or "").strip() or None

    async def dispatch(self, request: Request, call_next: Callable[[Request], Awaitable[JSONResponse]]) -> JSONResponse:
        if self._api_key is None or request.url.path in _OPEN_PATHS:
            return await call_next(request)
        if request.headers.get("x-api-key") == self._api_key:
            return await call_next(request)
        request_id = getattr(request.state, "request_id", "-")
        return JSONResponse(status_code=401, content=_error_payload("unauthorized", "valid X-API-Key required", request_id))


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(request: Request, exc: AppError) -> JSONResponse:
        rid = getattr(request.state, "request_id", "-")
        logger.warning(json.dumps({"event": "app_error", "code": exc.code, "message": exc.message, "request_id": rid}))
        return JSONResponse(status_code=exc.status_code, content=_error_payload(exc.code, exc.message, rid))

    @app.exception_handler(RequestValidationError)
    async def _validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        rid = getattr(request.state, "request_id", "-")
        first = exc.errors()[0] if exc.errors() else {}
        loc = ".".join(str(p) for p in first.get("loc", []))
        msg = f"invalid request: {loc}: {first.get('msg', 'validation failed')}"
        return JSONResponse(status_code=422, content=_error_payload("validation_error", msg, rid))

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        rid = getattr(request.state, "request_id", "-")
        logger.exception(json.dumps({"event": "unhandled_exception", "request_id": rid}))
        return JSONResponse(status_code=500, content=_error_payload("internal_error", "unexpected server error; reference the request id in logs", rid))


def configure_logging(level: int = logging.INFO) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(level)
    logging.getLogger("uvicorn.access").handlers = [handler]
