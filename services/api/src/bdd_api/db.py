"""SQLAlchemy persistence layer. Dual-mode: SQLite for instant local start,
Postgres via ``BDD_DATABASE_URL``. JSON columns keep engine payloads schema-
flexible while typed columns drive filtering and indexes.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Float, Index, String, create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

logger = logging.getLogger("bdd.db")


def _utcnow() -> datetime:
    return datetime.now(UTC)


class Base(DeclarativeBase):
    pass


class ArtifactRow(Base):
    __tablename__ = "artifacts"

    artifact_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    source_id: Mapped[str] = mapped_column(String(128), index=True)
    title: Mapped[str | None]
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    media_type: Mapped[str]
    byte_size: Mapped[int]
    raw_uri: Mapped[str]
    release_date: Mapped[str | None]
    manifest_json: Mapped[dict[str, Any]] = mapped_column(JSON)
    profile_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=None)
    fitness_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


Index("ix_artifacts_source_created", ArtifactRow.source_id, ArtifactRow.created_at)


class FindingRow(Base):
    __tablename__ = "findings"

    finding_id: Mapped[str] = mapped_column(String(160), primary_key=True)
    kind: Mapped[str] = mapped_column(String(32), index=True)  # anomaly|contradiction|drift|consensus|quality
    severity: Mapped[str] = mapped_column(String(16), index=True)
    confidence: Mapped[str]
    status: Mapped[str] = mapped_column(String(48), default="open", index=True)
    title: Mapped[str]
    summary: Mapped[str]
    payload_json: Mapped[dict[str, Any]] = mapped_column(JSON)
    artifact_ids: Mapped[list[Any]] = mapped_column(JSON)
    job_id: Mapped[str | None] = mapped_column(String(64), index=True, default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    reviewer_note: Mapped[str | None] = mapped_column(String(2048), default=None)


ALLOWED_REVIEW_STATUSES = {"open", "needs_source_clarification", "resolved", "not_detectable", "false_positive_after_review"}


class JobRow(Base):
    __tablename__ = "jobs"
    job_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    kind: Mapped[str] = mapped_column(String(48))
    status: Mapped[str] = mapped_column(String(16), default="queued", index=True)  # queued|running|done|failed
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    steps_json: Mapped[list[Any]] = mapped_column(JSON, default=list)
    result_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, default=None)
    error: Mapped[str | None] = mapped_column(String(2048), default=None)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class SchemaVersion(Base):
    """Lightweight schema ledger. `create_all` stays the source of truth;
    this row records which code version created the tables so a future
    Alembic migration can detect pre-migration databases."""

    __tablename__ = "schema_version"

    version: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


SCHEMA_VERSION = 1


class Engine:
    """Process-wide engine + session factory. Initialized once at startup."""

    def __init__(self, database_url: str) -> None:
        connect_args: dict[str, Any] = {}
        if database_url.startswith("sqlite"):
            connect_args = {"check_same_thread": False}
            directory = database_url.split("///")[-1].rsplit("/", 1)[0]
            if directory and not database_url.startswith("sqlite:///:memory:"):
                from pathlib import Path

                Path(directory).mkdir(parents=True, exist_ok=True)
        self.engine = create_engine(database_url, connect_args=connect_args, future=True)
        if database_url.startswith("sqlite"):
            @event.listens_for(self.engine, "connect")
            def _set_sqlite_pragma(dbapi_connection, connection_record):
                cursor = dbapi_connection.cursor()
                cursor.execute("PRAGMA foreign_keys=ON")
                cursor.execute("PRAGMA journal_mode=WAL")
                cursor.close()

        self.session_factory = sessionmaker(bind=self.engine, expire_on_commit=False, future=True)

    def create_all(self) -> None:
        Base.metadata.create_all(self.engine)

    def ping(self) -> bool:
        try:
            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return True
        except Exception:
            logger.exception("database ping failed")
            return False


_engine: Engine | None = None


def init_engine(database_url: str) -> Engine:
    global _engine
    _engine = Engine(database_url)
    _engine.create_all()
    try:
        with _engine.session_factory() as session:
            if session.get(SchemaVersion, SCHEMA_VERSION) is None:
                session.add(SchemaVersion(version=SCHEMA_VERSION))
                session.commit()
    except Exception:
        logger.exception("schema version stamp failed")
    return _engine


def get_engine() -> Engine:
    if _engine is None:
        raise RuntimeError("database engine not initialized")
    return _engine


def db_session() -> Session:
    return get_engine().session_factory()
