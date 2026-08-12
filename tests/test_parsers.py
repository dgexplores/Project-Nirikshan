from pathlib import Path

import pytest
from bdd_ingestion.parsers import ParseError, read_artifact


def test_csv_with_bom(tmp_path: Path) -> None:
    f = tmp_path / "bom.csv"
    f.write_bytes(b"\xef\xbb\xbfdistrict,beneficiaries\r\nBareilly,184\r\nMeerut,223\r\n")
    df, parser = read_artifact(f)
    assert df.height == 2
    assert parser == "polars_csv"


def test_latin1_fallback(tmp_path: Path) -> None:
    f = tmp_path / "latin.csv"
    f.write_bytes("district,caf\xe9\nX,1\n".encode("latin-1"))
    df, _ = read_artifact(f)
    assert df.height == 1


def test_tsv_and_jsonl_supported(tmp_path: Path) -> None:
    tsv = tmp_path / "t.tsv"
    tsv.write_text("a\tb\n1\t2\n", encoding="utf-8")
    assert read_artifact(tsv)[0].height == 1

    jl = tmp_path / "j.jsonl"
    jl.write_text('{"a": 1}\n{"a": 2}\n', encoding="utf-8")
    assert read_artifact(jl)[0].height == 2


def test_unsupported_format_raises(tmp_path: Path) -> None:
    bad = tmp_path / "x.docx"
    bad.write_text("nope", encoding="utf-8")
    with pytest.raises(ParseError):
        read_artifact(bad)