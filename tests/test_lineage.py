import io

import polars as pl
import pytest
from bdd_contracts.anomaly import AnomalyFinding
from bdd_contracts.artifact import ArtifactManifest, ParserInfo, SourceInfo
from bdd_contracts.lineage import LineageEdge, LineageGraph, LineageNode
from bdd_forensics.lineage import build_lineage
from bdd_forensics.profiler import profile_dataset


def _manifest() -> ArtifactManifest:
    return ArtifactManifest(
        artifact_id="art-lin",
        source=SourceInfo(source_id="SRC-X"),
        sha256="a" * 64,
        media_type="text/csv",
        byte_size=100,
        parser=ParserInfo(name="polars_csv", version="1.0", config_hash="b" * 64),
        raw_uri="/tmp/x.csv",
    )


def _finding() -> AnomalyFinding:
    return AnomalyFinding(
        finding_id="an-001",
        metric="v",
        slice={"district": "B"},
        observed=5000,
        expected=2500,
        baseline=2500,
        method="zscore",
        score=4.0,
        severity="high",
        confidence="high",
        evidence_query="v > mean + 3*sigma",
        caveats=[],
    )


def test_build_lineage_shape_and_validation() -> None:
    df = pl.read_csv(io.StringIO("district,v\nA,1\nB,5000\n"))
    profile = profile_dataset(dataset_id="ds", artifact_id="art-lin", df=df)
    graph = build_lineage(_manifest(), profile, [_finding()])
    graph.validate_graph()

    kinds = {n.kind for n in graph.nodes}
    assert kinds == {"raw_artifact", "parser", "profile", "rule", "finding"}

    path = graph.path_to_raw("finding:an-001")
    assert path[0].startswith("raw:")
    assert path[-1] == "finding:an-001"

    data = graph.model_dump(by_alias=True)
    edge_keys = set(data["edges"][0].keys())
    assert edge_keys == {"from", "to", "relation"}


def test_duplicate_node_rejected() -> None:
    graph = LineageGraph(
        nodes=[
            LineageNode(id="a", kind="raw_artifact", label="a"),
            LineageNode(id="a", kind="parser", label="dup"),
        ],
        edges=[LineageEdge(source_node="a", target_node="a", relation="x")],
    )
    with pytest.raises(ValueError, match="duplicate"):
        graph.validate_graph()


def test_cycle_rejected() -> None:
    graph = LineageGraph(
        nodes=[
            LineageNode(id="a", kind="raw_artifact", label="a"),
            LineageNode(id="b", kind="parser", label="b"),
        ],
        edges=[
            LineageEdge(source_node="a", target_node="b", relation="r1"),
            LineageEdge(source_node="b", target_node="a", relation="r2"),
        ],
    )
    with pytest.raises(ValueError, match="cycle"):
        graph.validate_graph()


def test_dangling_edge_rejected() -> None:
    graph = LineageGraph(
        nodes=[LineageNode(id="a", kind="raw_artifact", label="a")],
        edges=[LineageEdge(source_node="a", target_node="ghost", relation="r")],
    )
    with pytest.raises(ValueError, match="unknown node"):
        graph.validate_graph()
