"""Artifact parsers. Reads many tabular formats into a polars DataFrame
with parser version tracking. Prefers polars scan/read; falls back to
encoding sniffing for CSV.
"""

from __future__ import annotations

import json
from collections.abc import Callable
from pathlib import Path

import polars as pl

SUPPORTED = {".csv", ".tsv", ".xlsx", ".json", ".jsonl", ".parquet"}

_ENCODINGS = ["utf-8", "utf-8-sig", "latin-1"]


class ParseError(ValueError):
    """Raised when an artifact cannot be parsed."""


def _read_csv(path: Path) -> pl.DataFrame:
    last_error: Exception | None = None
    for encoding in _ENCODINGS:
        try:
            return pl.read_csv(path, encoding=encoding, infer_schema_length=10_000)
        except Exception as exc:  # noqa: BLE001 - try next encoding
            last_error = exc
    raise ParseError(f"unparseable CSV {path.name}: {last_error}") from last_error


def _read_xlsx(path: Path) -> pl.DataFrame:
    try:
        return pl.read_excel(path)
    except Exception as exc:
        raise ParseError(f"unparseable XLSX {path.name}: {exc}") from exc


def _read_json(path: Path) -> pl.DataFrame:
    try:
        return pl.read_ndjson(path)
    except Exception:  # noqa: BLE001
        try:
            return pl.DataFrame(json.loads(path.read_text(encoding="utf-8")))
        except Exception as exc:
            raise ParseError(f"unparseable JSON {path.name}: {exc}") from exc


def _read_parquet(path: Path) -> pl.DataFrame:
    try:
        return pl.read_parquet(path)
    except Exception as exc:
        raise ParseError(f"unparseable Parquet {path.name}: {exc}") from exc


_READERS: dict[str, Callable[[Path], pl.DataFrame]] = {
    ".csv": _read_csv,
    ".tsv": _read_csv,
    ".xlsx": _read_xlsx,
    ".json": _read_json,
    ".jsonl": _read_json,
    ".parquet": _read_parquet,
}


def read_artifact(path: Path) -> tuple[pl.DataFrame, str]:
    """Return (dataframe, parser_name). Raises ParseError on failure."""
    suffix = path.suffix.lower()
    if suffix not in SUPPORTED:
        raise ParseError(f"unsupported format: {suffix} (supported: {sorted(SUPPORTED)})")
    return _READERS[suffix](path), f"polars_{suffix.lstrip('.')}"