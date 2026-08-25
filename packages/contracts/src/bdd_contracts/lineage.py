"""Evidence lineage graph contract (spec engine 9, section 10.2).

Every displayed claim must trace back through extraction, normalization,
aggregation and rule execution to raw evidence. The graph here is the
serializable form of that trace for a single artifact.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

NodeKind = Literal["raw_artifact", "parser", "profile", "rule", "finding"]


class LineageNode(BaseModel):
    id: str
    kind: NodeKind
    label: str
    detail: str | None = None


class LineageEdge(BaseModel):
    """Directed edge; serialized with JSON keys ``from``/``to``."""

    model_config = ConfigDict(populate_by_name=True)

    source_node: str = Field(serialization_alias="from")
    target_node: str = Field(serialization_alias="to")
    relation: str


class LineageGraph(BaseModel):
    nodes: list[LineageNode]
    edges: list[LineageEdge]
    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    def validate_graph(self) -> None:
        """Raise ValueError on duplicate nodes, dangling edges or cycles."""
        ids = [n.id for n in self.nodes]
        if len(ids) != len(set(ids)):
            raise ValueError("duplicate node ids in lineage graph")
        id_set = set(ids)
        for edge in self.edges:
            if edge.source_node not in id_set or edge.target_node not in id_set:
                raise ValueError(f"edge references unknown node: {edge.source_node}->{edge.target_node}")
        adjacency: dict[str, set[str]] = {}
        for edge in self.edges:
            adjacency.setdefault(edge.source_node, set()).add(edge.target_node)
        state: dict[str, int] = {}

        def visit(node: str) -> None:
            mark = state.get(node, 0)
            if mark == 1:
                raise ValueError(f"cycle detected at {node}")
            if mark == 2:
                return
            state[node] = 1
            for nxt in adjacency.get(node, ()):
                visit(nxt)
            state[node] = 2

        for node_id in ids:
            visit(node_id)

    def path_to_raw(self, node_id: str) -> list[str]:
        """Return the longest upstream chain ending at ``node_id``."""
        incoming: dict[str, list[str]] = {}
        for edge in self.edges:
            incoming.setdefault(edge.target_node, []).append(edge.source_node)
        chain = [node_id]
        current = node_id
        while incoming.get(current):
            current = min(incoming[current])  # deterministic upstream choice
            chain.append(current)
        return list(reversed(chain))
