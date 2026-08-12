import io

from bdd_api.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_health() -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_ingest_and_fetch(tmp_path) -> None:
    csv = "district,beneficiaries\nBareilly,100\nMeerut,200\n"
    resp = client.post(
        "/artifacts/ingest",
        params={"artifact_id": "art_test_1", "source_id": "SRC-TEST"},
        files={"file": ("d.csv", io.BytesIO(csv.encode()), "text/csv")},
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["manifest"]["sha256"] == "ce6f4a4a139bcdad288a2284709d4e15000d641aae9a57c5e00ee11598559b78"
    assert body["profile"]["row_count"] == 2

    assert client.get("/artifacts/art_test_1/manifest").status_code == 200
    assert client.get("/artifacts/art_test_1/profile").status_code == 200
    assert client.get("/artifacts/nope/profile").status_code == 404


def test_duplicate_artifact_rejected() -> None:
    csv = "a\n1\n"
    resp = client.post(
        "/artifacts/ingest",
        params={"artifact_id": "art_test_2", "source_id": "SRC-TEST"},
        files={"file": ("d.csv", io.BytesIO(csv.encode()), "text/csv")},
    )
    assert resp.status_code == 201
    again = client.post(
        "/artifacts/ingest",
        params={"artifact_id": "art_test_2", "source_id": "SRC-TEST"},
        files={"file": ("d.csv", io.BytesIO(csv.encode()), "text/csv")},
    )
    assert again.status_code == 409