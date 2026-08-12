from pathlib import Path

from bdd_ingestion.manifest import build_manifest, sha256_file

SAMPLED = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"


def test_sha256_known_vector(tmp_path: Path) -> None:
    f = tmp_path / "x.bin"
    f.write_bytes(b"abc")
    assert sha256_file(f) == SAMPLED


def test_build_manifest_freezes_and_hashes(tmp_path: Path) -> None:
    src = tmp_path / "data.csv"
    src.write_text("a,b\n1,2\n", encoding="utf-8")
    raw = tmp_path / "raw"

    manifest = build_manifest(
        artifact_id="art_001",
        src=src,
        raw_store=raw,
        release_date="2026-01-01",
    )

    assert manifest.sha256 == sha256_file(src)
    assert Path(manifest.raw_uri).exists() is True
    assert manifest.byte_size == src.stat().st_size


def test_freeze_copy_never_overwrites(tmp_path: Path) -> None:
    src = tmp_path / "d.csv"
    raw = tmp_path / "raw"
    src.write_text("a\n1\n", encoding="utf-8")
    first = build_manifest(artifact_id="a", src=src, raw_store=raw).raw_uri
    second = build_manifest(artifact_id="b", src=src, raw_store=raw).raw_uri
    assert first == second
    src.write_text("a\n2\n", encoding="utf-8")
    third = build_manifest(artifact_id="c", src=src, raw_store=raw).raw_uri
    assert third != second