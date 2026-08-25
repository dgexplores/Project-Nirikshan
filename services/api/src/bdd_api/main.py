"""BDD API service.

Industrial surface: consistent error envelope with request ids, persisted
state (SQLite default / Postgres via BDD_DATABASE_URL), background ingest
jobs with step-level progress, deterministic forensic engines, and the Ask
Detective evidence service. See docs/ for the full specification.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware

from bdd_api.config import get_settings
from bdd_api.db import init_engine
from bdd_api.errors import RequestContextMiddleware, configure_logging, install_error_handlers
from bdd_api.jobs import shutdown_executor, start_executor


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging()
    settings.ensure_dirs()
    engine = init_engine(str(settings.database_url))
    start_executor(settings)
    logging.getLogger("bdd").info("startup complete db=%s", settings.database_url.split("://")[0])
    app.state.engine = engine
    yield
    shutdown_executor()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description=(
            "AI forensic & evidence-trust layer for Indian public data. "
            "Every finding is evidence-backed with lineage; the API never declares truth verdicts."
        ),
        lifespan=lifespan,
    )
    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    if settings.cors_origin_list:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origin_list,
            allow_methods=["*"],
            allow_headers=["*"],
            expose_headers=["X-Request-Id"],
        )

    install_error_handlers(app)

    from bdd_api.routers import router

    app.include_router(router)
    return app


app = create_app()
