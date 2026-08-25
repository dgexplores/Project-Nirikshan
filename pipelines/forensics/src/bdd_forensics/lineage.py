"""Evidence lineage graph builder (spec engine 9, section 10.2).

Constructs the serializable trace for one artifact:

    raw artifact -> parser -> profile -> rules -> findings

Every node carries an id stable across runs (derived from hashes and ids,
never runtime randomness) so a reviewer can rerun a case from pinned inputs.
"""

from __future__ import annotations

from bdd_contracts.anomaly import AnomalyFinding, ContradictionFinding, DriftFinding
from bdd_contracts.artifact import ArtifactManifest
from bdd_contracts.consensus import ConsensusFinding
from bdd_contracts.lineage import LineageEdge, LineageGraph, LineageNode
from bdd_contracts.profile import DatasetProfile


def build_lineage(
    manifest: ArtifactManifest,
    profile: DatasetProfile | None,
    findings: list[AnomalyFinding | ContradictionFinding | DriftFinding | ConsensusFinding],
) -> LineageGraph:
    """Build the lineage graph for one artifact and its derived findings."""
    nodes: list[LineageNode] = []
    edges: list[LineageEdge] = []

    raw_id = f"raw:{manifest.artifact_id}"
    nodes.append(
        LineageNode(
            id=raw_id,
            kind="raw_artifact",
            label=manifest.artifact_id,
            detail=f"sha256:{manifest.sha256[:16]}... bytes={manifest.byte_size}",
        )
    )

    parser_id = f"parser:{manifest.parser.name}:{manifest.parser.config_hash[:12]}"
    nodes.append(
        LineageNode(
            id=parser_id,
            kind="parser",
            label=f"{manifest.parser.name}@{manifest.parser.version}",
            detail=f"config_hash={manifest.parser.config_hash[:16]}...",
        )
    )
    edges.append(LineageEdge(source_node=raw_id, target_node=parser_id, relation="parsed_by"))

    profile_id = f"profile:{profile.profile_version}:{manifest.artifact_id}" if profile else None
    if profile is not None:
        nodes.append(
            LineageNode(
                id=profile_id,
                kind="profile",
                label=f"profile v{profile.profile_version}",
                detail=f"{profile.row_count} rows x {profile.column_count} cols, "
                f"{len(profile.quality_observations)} quality observation(s)",
            )
        )
        edges.append(LineageEdge(source_node=parser_id, target_node=profile_id, relation="profiled_by"))

        rule_ids: dict[str, str] = {}
        used_finding_ids: set[str] = set()
        finding_specs: list[tuple[str, str]] = []
        for idx, finding in enumerate(findings):
            method_or_type = getattr(finding, "method", None) or getattr(finding, "drift_type", None) or type(finding).__name__
            rule_key = str(method_or_type)
            if rule_key not in rule_ids:
                rule_ids[rule_key] = f"rule:{rule_key}"
                nodes.append(
                    LineageNode(
                        id=rule_ids[rule_key],
                        kind="rule",
                        label=str(method_or_type),
                        detail="deterministic engine; rerun reproducible from pinned inputs",
                    )
                )
                assert profile_id is not None
                edges.append(LineageEdge(source_node=profile_id, target_node=rule_ids[rule_key], relation="executed_over"))
            base_id = f"finding:{finding.finding_id}"
            finding_node_id = base_id
            n = 0
            while finding_node_id in used_finding_ids:
                n += 1
                finding_node_id = f"{base_id}#{n}"
            used_finding_ids.add(finding_node_id)
            finding_specs.append((finding_node_id, f"[{idx}] {finding.finding_id}"))
            nodes.append(
                LineageNode(
                    id=finding_node_id,
                    kind="finding",
                    label=finding.finding_id,
                    detail=f"severity={finding.severity} confidence={getattr(finding, 'confidence', 'n/a')}",
                )
            )
            edges.append(LineageEdge(source_node=rule_ids[rule_key], target_node=finding_node_id, relation="produced"))

    graph = LineageGraph(nodes=nodes, edges=edges)
    graph.validate_graph()
    return graph
