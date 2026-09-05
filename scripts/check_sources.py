"""Source monitor (Tier-4 gap, additive).

Reads ``data/source-register.csv`` and reports rows needing attention:
malformed fields, missing provenance (sha256/retrieved_at), or stale
``access_status``. Read-only; exits nonzero when problems are found so CI
or cron can alert on silent portal revisions.

Usage:
    python scripts/check_sources.py
"""

from __future__ import annotations

import csv
from pathlib import Path

REGISTER = Path(__file__).resolve().parents[1] / "data" / "source-register.csv"
REQUIRED = ("source_id", "source_url", "retrieved_at", "sha256", "access_status")


def main() -> int:
    if not REGISTER.exists():
        print(f"missing register: {REGISTER}")
        return 2
    problems: list[str] = []
    with REGISTER.open(newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh))
    if not rows:
        print("register is empty")
        return 1
    header = set(rows[0].keys() or [])
    for col in REQUIRED:
        if col not in header:
            problems.append(f"missing column: {col}")
    for i, row in enumerate(rows, start=2):
        sid = (row.get("source_id") or f"row-{i}").strip()
        for col in REQUIRED:
            if not (row.get(col) or "").strip() or (row.get(col) or "").strip() == "TBD":
                problems.append(f"{sid}: {col} missing/TBD")
        if (row.get("access_status") or "").strip() == "unverified_candidate":
            problems.append(f"{sid}: still unverified_candidate")
    print(f"checked {len(rows)} registered source(s)")
    for p in problems:
        print(f" - {p}")
    return 1 if problems else 0


if __name__ == "__main__":
    raise SystemExit(main())
