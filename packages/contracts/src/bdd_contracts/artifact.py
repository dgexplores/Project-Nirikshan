"""Artifact manifest schema (spec section 11.1)."""

from datetime import UTC, datetime

from pydantic import BaseModel, Field


class SourceInfo(BaseModel):
    source_id: str = Field(description="Stable internal source identifier")
    publisher: str | None = None
    official_title: str | None = None
    source_url: str | None = None
    resource_url: str | None = None
    licence_or_terms: str | None = None


class ParserInfo(BaseModel):
    name: str = Field(description="Parser name, e.g. polars_csv")
    version: str = Field(description="Parser library version")
    config_hash: str = Field(description="SHA-256 of parser configuration")


class ArtifactManifest(BaseModel):
    artifact_id: str
    source: SourceInfo
    source_url: str | None = None
    retrieved_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC)
    )
    sha256: str
    media_type: str = Field(description="MIME type of the artifact")
    byte_size: int
    parser: ParserInfo
    release_date: str | None = None
    supersedes_artifact_id: str | None = None
    raw_uri: str = Field(description="URI of the immutable raw copy")