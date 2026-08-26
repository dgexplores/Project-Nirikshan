"""Deterministic synthetic demo corpus (clearly marked as derived data).

Seeding creates small public fixtures under ``data/fixtures/public/`` with
byte-stable content, ingests them through the normal pipeline, then runs the
forensic engines so a fresh install has a full case to explore:

- micro-irrigation releases FY2019-20 / FY2020-21  -> semantic drift (unit change)
- district irrigation with a planted outlier       -> anomaly findings
- two summaries of one PM-KISAN-style total        -> cross-source conflict
- digest derived from the state summary            -> false-consensus finding

All content is SYNTHETIC and marked as such in source ids and titles.
No CAG/benchmark labels are ever used here (governance rule).
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from bdd_forensics.false_consensus import SourceClaim, detect_false_consensus

from bdd_api.config import get_settings
from bdd_api.db import ArtifactRow, db_session
from bdd_api.jobs import StepReporter
from bdd_api.pipelines import persist_findings, run_anomalies, run_compare, run_ingest

logger = logging.getLogger("bdd.seed")

_DISTRICTS = ["Bareilly", "Meerut", "Gorakhpur", "Lucknow", "Kanpur", "Varanasi", "Agra", "Prayagraj"]

_MICRO_2019 = {
    "district": _DISTRICTS,
    "area_covered_hectares": [4120, 3890, 2760, 5310, 4980, 2210, 3640, 3050],
    "beneficiaries_lakh": [0.82, 0.74, 0.51, 1.06, 0.97, 0.42, 0.71, 0.58],
}
_MICRO_2020 = {
    "district": _DISTRICTS,
    "area_covered_hectares": [4395, 4102, 2908, 5611, 5247, 2338, 3809, 3216],
    # same measure re-reported in different units -> drift demo
    "beneficiaries_crore": [0.0091, 0.0083, 0.0057, 0.0118, 0.0108, 0.0047, 0.0079, 0.0065],
}

_IRR_ANOMALY = {
    "district": _DISTRICTS,
    "fy": [2020] * 8,
    # Agra carries a planted reporting spike -> anomaly engines demo
    "tube_wells_energised": [1240, 1188, 902, 1411, 1330, 764, 5200, 987],
    "subsidy_disbursed_inr_lakh": [310, 297, 226, 353, 333, 191, 1300, 247],
}

def _benford_violation_rows(n: int = 120) -> dict[str, list[Any]]:
    """Synthetic scheme payments whose first digits are UNIFORM 1..9 -
    exactly what fabricated-looking data looks like to Benford's law."""
    districts: list[str] = []
    fys: list[int] = []
    ids: list[str] = []
    amounts: list[float] = []
    for i in range(n):
        d = i % 9 + 1
        magnitude = (i // 18) % 4
        districts.append(_DISTRICTS[i % len(_DISTRICTS)])
        fys.append(2021 + (i // 40))
        ids.append(f"PAY-{100000 + i * 7}")
        amounts.append(round(d * (1 + ((i * 37) % 80) / 1000.0) * float(10.0**magnitude), 2))
    return {"district": districts, "fy": fys, "payment_id": ids, "amount_inr": amounts}


_PMKISAN_STATE = {"district": ["Haryana"], "payment_total_inr": [13140]}
_PMKISAN_DIGEST = {"district": ["Haryana"], "payment_total_inr": [12890]}


def _csv_bytes(columns: dict[str, list[Any]]) -> bytes:
    headers = list(columns.keys())
    lines = [",".join(headers)]
    n_rows = len(next(iter(columns.values())))
    for i in range(n_rows):
        lines.append(",".join(str(columns[h][i]) for h in headers))
    return ("\n".join(lines) + "\n").encode("utf-8")


FIXTURES: list[dict[str, Any]] = [
    {
        "filename": "micro_irrigation_fy2019-20.csv",
        "artifact_id": "art-demo-micro-1920",
        "source_id": "SRC-SYNTH-MICRO-1920",
        "title": "Micro-irrigation coverage FY 2019-20 (synthetic)",
        "release_date": "FY 2019-20",
        "content": _MICRO_2019,
    },
    {
        "filename": "micro_irrigation_fy2020-21.csv",
        "artifact_id": "art-demo-micro-2021",
        "source_id": "SRC-SYNTH-MICRO-2021",
        "title": "Micro-irrigation coverage FY 2020-21 (synthetic)",
        "release_date": "FY 2020-21",
        "content": _MICRO_2020,
    },
    {
        "filename": "irrigation_anomaly_demo.csv",
        "artifact_id": "art-demo-irr-anomaly",
        "source_id": "SRC-SYNTH-IRR",
        "title": "District irrigation energisation FY 2020 (synthetic)",
        "release_date": "FY 2020-21",
        "content": _IRR_ANOMALY,
    },
    {
        "filename": "scheme_payments_benford_demo.csv",
        "artifact_id": "art-demo-benford",
        "source_id": "SRC-SYNTH-BENFORD",
        "title": "Scheme payments register - digit-pattern demo (synthetic)",
        "release_date": "FY 2021-22",
        "content": _benford_violation_rows(),
    },
    {
        "filename": "pmkisan_state_release.csv",
        "artifact_id": "art-demo-pmk-state",
        "source_id": "SRC-SYNTH-PMK-A",
        "title": "State release summary (synthetic)",
        "release_date": "FY 2023-24",
        "content": _PMKISAN_STATE,
    },
    {
        "filename": "pmkisan_digest.csv",
        "artifact_id": "art-demo-pmk-digest",
        "source_id": "SRC-SYNTH-PMK-B",
        "title": "District digest reprint (derived from state release, synthetic)",
        "release_date": "FY 2023-24",
        "content": _PMKISAN_DIGEST,
    },
]


class SilentStepReporter(StepReporter):
    """No-op reporter for synchronous seeding."""

    def __init__(self) -> None:
        super().__init__("seed")

    def start(self, name: str, detail: str | None = None) -> None:
        pass

    def done(self, name: str, detail: str | None = None) -> None:
        pass

    def fail(self, name: str, detail: str) -> None:
        pass


def ensure_fixture_files(fixtures_dir: Path) -> list[Path]:
    """Write byte-stable fixture CSVs if missing."""
    fixtures_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for spec in FIXTURES:
        path = fixtures_dir / spec["filename"]
        expected = _csv_bytes(spec["content"])
        if not path.exists() or path.read_bytes() != expected:
            path.write_bytes(expected)
        paths.append(path)
    return paths


def seed_demo() -> dict[str, Any]:
    settings = get_settings()
    fixtures_dir = settings.fixtures_dir
    ensure_fixture_files(fixtures_dir)

    seeded: list[str] = []
    skipped: list[str] = []
    reporter = SilentStepReporter()

    for spec in FIXTURES:
        artifact_id = spec["artifact_id"]
        with db_session() as session:
            exists = session.get(ArtifactRow, artifact_id) is not None
        if exists:
            skipped.append(artifact_id)
            continue
        path = fixtures_dir / spec["filename"]
        run_ingest(
            tmp_path=path,
            original_filename=spec["filename"],
            artifact_id=artifact_id,
            source_id=spec["source_id"],
            title=spec["title"],
            release_date=spec["release_date"],
            settings=settings,
            reporter=reporter,
        )
        run_anomalies(artifact_id)
        seeded.append(artifact_id)

    findings_written = 0

    # Drift + contradiction demo across the two micro-irrigation releases.
    have_pair = all(
        _exists(aid)
        for aid in ("art-demo-micro-1920", "art-demo-micro-2021")
    )
    if have_pair:
        result = run_compare(
            "art-demo-micro-1920",
            "beneficiaries_lakh",
            "art-demo-micro-2021",
            "beneficiaries_crore",
        )
        findings_written += result["findings_written"]

    # False-consensus demo: digest derives from the state release.
    if all(_exists(aid) for aid in ("art-demo-pmk-state", "art-demo-pmk-digest")):
        claims: list[SourceClaim] = [
            {
                "claim_id": "cl-state-release",
                "metric": "payment_total_inr",
                "value": _PMKISAN_STATE["payment_total_inr"][0],
                "artifact_id": "art-demo-pmk-state",
                "derived_from": None,
            },
            {
                "claim_id": "cl-digest-reprint",
                "metric": "payment_total_inr",
                "value": _PMKISAN_DIGEST["payment_total_inr"][0],
                "artifact_id": "art-demo-pmk-digest",
                "derived_from": "art-demo-pmk-state",
            },
        ]
        consensus = detect_false_consensus(claims)
        if consensus is not None:
            findings_written += persist_findings(
                [consensus],
                ["art-demo-pmk-state", "art-demo-pmk-digest"],
                ["consensus"],
                None,
            )

    return {"seeded": seeded, "skipped": skipped, "new_findings": findings_written}


def _exists(artifact_id: str) -> bool:
    with db_session() as session:
        return session.get(ArtifactRow, artifact_id) is not None
