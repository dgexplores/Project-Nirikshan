"""CLI entry point for artifact ingestion.

Usage:
    python -m bdd_ingestion.cli ingest <file> --artifact-id art_... \
        --source-id SRC-... --raw-store data/raw --out data/manifests
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from bdd_contracts.artifact import SourceInfo

from .manifest import build_manifest
from .parsers import ParseError, read_artifact


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="bdd-ingest")
    sub = ap.add_subparsers(dest="command", required=True)

    ingest = sub.add_parser("ingest", help="Freeze + manifest + parse an artifact")
    ingest.add_argument("file", type=Path)
    ingest.add_argument("--artifact-id", required=True)
    ingest.add_argument("--source-id", required=True)
    ingest.add_argument("--title", default=None)
    ingest.add_argument("--raw-store", type=Path, default=Path("data/raw"))
    ingest.add_argument("--out", type=Path, default=Path("data/manifests"))
    ingest.add_argument("--release-date", default=None)

    args = ap.parse_args(argv)

    if args.command == "ingest":
        try:
            df, parser_name = read_artifact(args.file)
        except ParseError as exc:
            print(f"parse error: {exc}", file=sys.stderr)
            return 1

        manifest = build_manifest(
            artifact_id=args.artifact_id,
            src=args.file,
            raw_store=args.raw_store,
            source=SourceInfo(
                source_id=args.source_id, official_title=args.title
            ),
            parser_name=parser_name,
            release_date=args.release_date,
            # media_type resolved by parser family is good enough for V1
            media_type=f"application/{parser_name.split('_')[1]}",
        )

        args.out.mkdir(parents=True, exist_ok=True)
        manifest_path = args.out / f"{manifest.artifact_id}.json"
        manifest_path.write_text(
            manifest.model_dump_json(indent=2) + "\n",
            encoding="utf-8",
        )
        print(
            json.dumps(
                {
                    "artifact_id": manifest.artifact_id,
                    "sha256": manifest.sha256,
                    "rows": df.height,
                    "columns": df.width,
                    "raw_uri": manifest.raw_uri,
                    "manifest": str(manifest_path),
                },
                indent=2,
            )
        )
        return 0

    ap.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())