import io

from conftest import wait_job
from fastapi.testclient import TestClient

CSV_HASH = "ce6f4a4a139bcdad288a2284709d4e15000d641aae9a57c5e00ee11598559b78"


def _ingest(client: TestClient, artifact_id: str, csv: str, wait: bool = True) -> dict:
    resp = client.post(
        "/artifacts/ingest",
        params={"artifact_id": artifact_id, "source_id": "SRC-TEST"},
        files={"file": ("d.csv", io.BytesIO(csv.encode()), "text/csv")},
    )
    assert resp.status_code == 202, resp.text
    body = resp.json()
    if wait:
        job = wait_job(client, body["job_id"])
        assert job["status"] == "done", job
    return body


def test_health_and_ready(api: TestClient) -> None:
    assert api.get("/health").json()["status"] == "ok"
    ready = api.get("/health/ready").json()
    assert ready["database"] is True


def test_ingest_lifecycle_with_job_progress(api: TestClient) -> None:
    csv = "district,beneficiaries\nBareilly,100\nMeerut,200\n"
    accepted = _ingest(api, "art_test_1", csv)
    job = wait_job(api, accepted["job_id"])
    assert job["status"] == "done"
    assert job["progress"] == 100.0
    assert all(step["status"] == "done" for step in job["steps"])
    assert job["result"]["sha256"] == CSV_HASH
    assert job["result"]["rows"] == 2

    manifest = api.get("/artifacts/art_test_1/manifest")
    assert manifest.status_code == 200
    assert manifest.json()["sha256"] == CSV_HASH

    profile = api.get("/artifacts/art_test_1/profile").json()
    assert profile["row_count"] == 2

    fitness = api.get("/artifacts/art_test_1/fitness").json()
    assert 0 <= fitness["score"] <= 100
    assert fitness["grade"] in {"A", "B", "C", "D", "F"}

    lineage = api.get("/artifacts/art_test_1/lineage").json()
    kinds = {n["kind"] for n in lineage["nodes"]}
    assert {"raw_artifact", "parser", "profile"} <= kinds
    edges = {(e["from"], e["to"]) for e in lineage["edges"]}
    assert edges

    listing = api.get("/artifacts").json()
    assert listing["total"] == 1
    assert listing["items"][0]["artifact_id"] == "art_test_1"


def test_duplicate_artifact_conflict_envelope(api: TestClient) -> None:
    csv = "a\n1\n"
    _ingest(api, "art_dup", csv)
    again = api.post(
        "/artifacts/ingest",
        params={"artifact_id": "art_dup", "source_id": "SRC-TEST"},
        files={"file": ("d.csv", io.BytesIO(csv.encode()), "text/csv")},
    )
    assert again.status_code == 409
    err = again.json()["error"]
    assert err["code"] == "artifact_exists"
    assert err["request_id"]


def test_duplicate_inflight_conflict(api: TestClient) -> None:
    """Second submit while first job still running must 409, not clobber."""
    csv = "a\n1\n"
    first = _ingest(api, "art_race", csv, wait=False)
    second = api.post(
        "/artifacts/ingest",
        params={"artifact_id": "art_race", "source_id": "SRC-TEST"},
        files={"file": ("d.csv", io.BytesIO(csv.encode()), "text/csv")},
    )
    assert second.status_code == 409
    wait_job(api, first["job_id"])


def test_unsupported_format_rejected(api: TestClient) -> None:
    resp = api.post(
        "/artifacts/ingest",
        params={"artifact_id": "art_docx", "source_id": "SRC-TEST"},
        files={"file": ("notes.docx", io.BytesIO(b"junk"), "application/octet-stream")},
    )
    assert resp.status_code == 400
    assert resp.json()["error"]["code"] == "unsupported_format"


def test_empty_file_rejected(api: TestClient) -> None:
    resp = api.post(
        "/artifacts/ingest",
        params={"artifact_id": "art_empty", "source_id": "SRC-TEST"},
        files={"file": ("e.csv", io.BytesIO(b""), "text/csv")},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "empty_file"


def test_unknown_artifact_404_envelope(api: TestClient) -> None:
    resp = api.get("/artifacts/nope/profile")
    assert resp.status_code == 404
    assert resp.json()["error"]["code"] == "artifact_not_found"


def test_unknown_job_404(api: TestClient) -> None:
    assert api.get("/jobs/doesnotexist").status_code == 404


def test_findings_review_flow(api: TestClient) -> None:
    csv = (
        "district,value\nA,1\nB,2\nC,3\nD,4\nE,5000\nF,6\nG,7\nH,8\n"
    )
    _ingest(api, "art_anom", csv)
    analyze = api.post("/artifacts/art_anom/analyze")
    assert analyze.status_code == 200
    assert analyze.json()["findings_written"] >= 1

    listed = api.get("/findings", params={"kind": "anomaly"}).json()
    assert listed["total"] >= 1
    fid = listed["items"][0]["id"]

    detail = api.get(f"/findings/{fid}").json()
    assert detail["payload"]["method"]
    assert detail["artifact_ids"] == ["art_anom"]

    reviewed = api.post(f"/findings/{fid}/review", json={"status": "resolved", "note": "checked against source"})
    assert reviewed.status_code == 200
    assert api.get(f"/findings/{fid}").json()["status"] == "resolved"

    bad = api.post(f"/findings/{fid}/review", json={"status": "not-a-status"})
    assert bad.status_code == 422


def test_analyze_handles_zero_baseline_yoy_finding(api: TestClient) -> None:
    # A zero-baseline YoY finding carries score=None (percent change is
    # undefined). run_anomalies used to sort all findings by abs(score)
    # unconditionally and crashed with a real multi-district, multi-year
    # file that happened to include one, this reproduces that shape.
    csv = "district,year,amount\nA,2023,0\nA,2024,500\nB,2023,10\nB,2024,12\n"
    _ingest(api, "art_zero_baseline", csv)
    analyze = api.post("/artifacts/art_zero_baseline/analyze")
    assert analyze.status_code == 200, analyze.text


def test_analyze_ignores_identifier_and_calendar_columns(api: TestClient) -> None:
    # Found via a real 47M-row AI Kosh dataset (Kisan Call Centre) that had
    # a call-id column and day/month columns but no genuine numeric metric.
    # run_anomalies used to treat every Int/Float column as a metric, so it
    # confidently flagged a handful of call ids and calendar days as
    # "anomalies", noise with no evidence value. A record's id or the day
    # of the month it landed on is not expected to follow any distribution.
    rows = [f"{1000 + i},{(i % 28) + 1},{(i % 12) + 1},{10 + (i % 5)}" for i in range(20)]
    rows.append("9999,15,6,5000")  # one genuine, extreme metric outlier
    csv = "call_id,day,month,amount\n" + "\n".join(rows) + "\n"
    _ingest(api, "art_id_calendar", csv)
    analyze = api.post("/artifacts/art_id_calendar/analyze")
    assert analyze.status_code == 200, analyze.text

    findings = api.get("/findings", params={"kind": "anomaly"}).json()["items"]
    ours = [f for f in findings if "art_id_calendar" in f["artifact_ids"]]
    assert ours, "expected the genuine amount outlier to be flagged"
    for f in ours:
        words = set(f["title"].lower().split())
        assert not {"call_id", "day", "month"} & words, f["title"]
    assert any("amount" in f["title"] for f in ours)


def test_compare_two_artifacts_produces_finding(api: TestClient) -> None:
    _ingest(api, "cmp_a", "district,total_inr\nA,100\nB,200\nC,300\n")
    _ingest(api, "cmp_b", "district,total_inr\nA,105\nB,210\nC,315\n")
    resp = api.post(
        "/compare",
        json={"artifact_a": "cmp_a", "column_a": "total_inr", "artifact_b": "cmp_b", "column_b": "total_inr"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["overall"] in {"comparable", "partial"}
    assert len(body["gates"]) >= 3
    assert body["contradiction"]["reconciliation_status"] in {"conflict", "explainable"}

    findings = api.get("/findings", params={"kind": "contradiction"}).json()
    assert findings["total"] >= 1


def test_compare_missing_column_maps_to_error_envelope(api: TestClient) -> None:
    _ingest(api, "cx_a", "district,x\nA,1\n")
    _ingest(api, "cx_b", "district,y\nA,2\n")
    resp = api.post(
        "/compare",
        json={"artifact_a": "cx_a", "column_a": "nope", "artifact_b": "cx_b", "column_b": "y"},
    )
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "column_not_found"


def test_validation_error_envelope(api: TestClient) -> None:
    resp = api.post("/ask", json={})
    assert resp.status_code == 422
    err = resp.json()["error"]
    assert err["code"] == "validation_error"
