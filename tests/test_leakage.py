"""Governance leakage guard (benchmark protocol): CAG case identifiers and
distinctive label phrases must never appear in app code, prompts or fixtures.
The restricted registry stays out of the running system; this test enforces
the boundary mechanically.
"""

from __future__ import annotations

import csv
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

SCAN_ROOTS = [
    REPO_ROOT / "services",
    REPO_ROOT / "packages",
    REPO_ROOT / "pipelines",
    REPO_ROOT / "apps" / "web" / "src",
    REPO_ROOT / "data" / "fixtures",
]
SCAN_EXTENSIONS = {".py", ".ts", ".tsx", ".js", ".json", ".csv", ".md", ".toml", ".yml", ".yaml"}
SKIP_DIRS = {"node_modules", ".next", ".venv", "__pycache__"}

_PHRASE_TOKENS = 5  # n-gram length for distinctive-phrase extraction


def _labels() -> tuple[list[str], list[str]]:
    """Return (case_ids, distinctive_phrases) from the hidden registry."""
    registry = REPO_ROOT / "data" / "benchmark-restricted" / "case_registry.csv"
    case_ids: set[str] = set()
    phrases: set[str] = set()
    if registry.exists():
        with registry.open(newline="") as handle:
            for row in csv.DictReader(handle):
                if cid := (row.get("benchmark_case_id") or "").strip():
                    case_ids.add(cid)
                parts = []
                for col in ("audit_report_title", "observation_summary"):
                    raw = (row.get(col) or "").replace(",", " ").replace("(", " ").replace(")", " ").lower()
                    parts.append(" ".join(raw.split()))
                words = re.findall(r"[a-z0-9]+", " ".join(parts))
                for i in range(len(words) - _PHRASE_TOKENS + 1):
                    gram = " ".join(words[i : i + _PHRASE_TOKENS])
                    # skip grams dominated by generic vocabulary
                    if len(gram) >= 20:
                        phrases.add(gram)
    return sorted(case_ids), sorted(phrases)


def _iter_source_files():
    for root in SCAN_ROOTS:
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            if path.is_file() and path.suffix.lower() in SCAN_EXTENSIONS:
                yield path


def test_registry_present_and_extracted() -> None:
    case_ids, phrases = _labels()
    assert len(case_ids) >= 3, "benchmark registry missing - leakage test cannot run meaningfully"
    assert len(phrases) >= 3


def test_no_benchmark_labels_in_application_code() -> None:
    case_ids, phrases = _labels()
    violations: list[str] = []
    for path in _iter_source_files():
        content = path.read_text(errors="ignore")
        lowered = content.lower()
        for cid in case_ids:
            if cid in content:
                violations.append(f"{path.relative_to(REPO_ROOT)} contains case id '{cid}'")
        for phrase in phrases:
            if phrase in lowered:
                violations.append(f"{path.relative_to(REPO_ROOT)} contains label phrase '{phrase}'")
    assert not violations, "benchmark label leakage detected:\n" + "\n".join(violations[:20])


def test_restricted_dir_not_referenced_from_app_packages() -> None:
    """The API package must have zero references to the restricted store."""
    for path in (REPO_ROOT / "services").rglob("*.py"):
        content = path.read_text(errors="ignore")
        assert "benchmark-restricted" not in content, f"{path} references the restricted benchmark store"
