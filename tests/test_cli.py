"""CLI tests: exercise bdd_cli.main against an isolated database."""

from __future__ import annotations

import pytest
from bdd_cli.main import main


@pytest.fixture(autouse=True)
def _cli_env(tmp_path, monkeypatch):
    monkeypatch.setenv("BDD_DATABASE_URL", f"sqlite:///{tmp_path / 'cli.db'}")
    monkeypatch.setenv("BDD_RAW_STORE", str(tmp_path / "raw"))
    monkeypatch.setenv("BDD_MANIFEST_DIR", str(tmp_path / "manifests"))
    monkeypatch.setenv("BDD_FIXTURES_DIR", str(tmp_path / "fixtures"))
    from bdd_api import config

    config.get_settings.cache_clear()
    from bdd_api import db

    db._engine = None
    yield
    config.get_settings.cache_clear()


@pytest.fixture()
def seeded(capsys):
    assert main(["seed"]) == 0
    capsys.readouterr()  # discard seed chatter so tests read clean output
    return True


def test_summary_after_seed(capsys, seeded) -> None:
    assert main(["summary"]) == 0
    out = capsys.readouterr().out
    assert "artifacts:" in out
    assert "benford" in out or "findings" in out


def test_artifacts_listing(capsys, seeded) -> None:
    assert main(["artifacts"]) == 0
    out = capsys.readouterr().out
    assert "art-demo-micro-1920" in out
    assert "A" in out


def test_artifacts_json(capsys, seeded) -> None:
    import json

    assert main(["artifacts", "--json"]) == 0
    items = json.loads(capsys.readouterr().out)
    assert len(items) == 6
    assert {"artifact_id", "sha256", "grade"} <= set(items[0])


def test_findings_filter_and_review(capsys, seeded) -> None:
    assert main(["findings", "--kind", "benford", "--json"]) == 0
    import json

    items = json.loads(capsys.readouterr().out)
    assert len(items) == 1
    fid = items[0]["id"]

    assert main(["review", fid, "--status", "resolved", "--note", "checked"]) == 0
    assert main(["findings", "--kind", "benford", "--json"]) == 0
    tail = capsys.readouterr().out.strip().splitlines()[-1]
    assert json.loads(tail) == []  # default filter is status=open


def test_compare_command_output(capsys, seeded) -> None:
    rc = main(
        [
            "compare",
            "art-demo-micro-1920",
            "beneficiaries_lakh",
            "art-demo-micro-2021",
            "beneficiaries_crore",
        ]
    )
    assert rc == 0
    out = capsys.readouterr().out
    assert "NOT COMPARABLE" in out
    assert "units differ" in out
    assert "drift:" in out


def test_ask_refusal_and_cited(capsys, tmp_path, seeded) -> None:
    assert main(["ask", "quantum entanglement metrics xyzzy"]) == 0
    refusal_out = capsys.readouterr().out
    assert "refusal" in refusal_out.lower()

    assert main(["ask", "benford amount_inr digits"]) == 0
    assert "[E1]" in capsys.readouterr().out


def test_ingest_and_show_roundtrip(capsys, seeded, tmp_path) -> None:
    csv_file = tmp_path / "sales.csv"
    csv_file.write_text("district,sales_lakh\nA,10\nB,20\n")
    rc = main(["ingest", str(csv_file), "--source-id", "SRC-CLI", "--artifact-id", "art-cli-1"])
    assert rc == 0

    assert main(["show", "art-cli-1"]) == 0
    out = capsys.readouterr().out
    assert "art-cli-1" in out
    assert "sales_lakh" in out


def test_unknown_finding_errors_cleanly(capsys, seeded) -> None:
    assert main(["finding", "nope-123"]).__class__ is int
    rc = main(["finding", "nope-123"])
    assert rc == 1


def test_review_invalid_status_rejected(seeded) -> None:
    import pytest

    with pytest.raises(SystemExit) as excinfo:
        main(["review", "whatever", "--status", "bogus"])
    assert excinfo.value.code == 2
