"""Central configuration. Every runtime knob is a ``BDD_``-prefixed env var;
``.env.example`` documents them. No other module reads os.environ directly.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

SUPPORTED_EXTENSIONS = {".csv", ".tsv", ".xlsx", ".json", ".jsonl", ".parquet"}

MEDIA_TYPES: dict[str, str] = {
    ".csv": "text/csv",
    ".tsv": "text/tab-separated-values",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".json": "application/json",
    ".jsonl": "application/x-ndjson",
    ".parquet": "application/vnd.apache.parquet",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="BDD_", env_file=".env", extra="ignore")

    app_name: str = "Bharat Data Detective API"
    app_version: str = "1.0.0"

    # sqlite by default; set BDD_DATABASE_URL=postgresql+psycopg://... for Postgres
    database_url: str = "sqlite:///data/bdd.db"
    raw_store: Path = Path("data/raw")
    manifest_dir: Path = Path("data/manifests")
    fixtures_dir: Path = Path("data/fixtures/public")

    cors_origins: str = "http://localhost:3000"
    max_upload_mb: int = 200

    # Optional OpenAI-compatible endpoint. When unset the Ask Detective runs
    # in deterministic mode (retrieval + templated synthesis, still cited).
    llm_base_url: str | None = None
    llm_api_key: str | None = None
    llm_model: str | None = None
    llm_timeout_s: float = 30.0

    job_workers: int = 2

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024

    def media_type_for(self, filename: str) -> str:
        return MEDIA_TYPES.get(Path(filename).suffix.lower(), "application/octet-stream")

    def ensure_dirs(self) -> None:
        self.raw_store.mkdir(parents=True, exist_ok=True)
        self.manifest_dir.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()
