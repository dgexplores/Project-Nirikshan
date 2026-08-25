"""Shared contract schemas for BDD. These are the typed boundaries between
services, pipelines and storage. Imported by all components.
"""

from bdd_contracts.anomaly import AnomalyFinding, ContradictionFinding, DriftFinding
from bdd_contracts.artifact import ArtifactManifest, ParserInfo, SourceInfo
from bdd_contracts.consensus import ConsensusFinding, ConsensusVerdict, OriginGroup
from bdd_contracts.finding import Claim, EvidenceRef, Finding
from bdd_contracts.fitness import FitnessComponent, FitnessGrade, FitnessScore
from bdd_contracts.lineage import LineageEdge, LineageGraph, LineageNode, NodeKind
from bdd_contracts.observation import ObservationRecord
from bdd_contracts.profile import (
    ColumnProfile,
    DatasetProfile,
    Distribution,
    PiiHint,
    QualityObservation,
    Severity,
)
from bdd_contracts.semantic import (
    DefinitionCard,
    GeoResolution,
    SchemaMapping,
    TemporalResolution,
    UnitNorm,
    UnresolvedField,
)

__all__ = [
    "AnomalyFinding",
    "ArtifactManifest",
    "Claim",
    "ColumnProfile",
    "ConsensusFinding",
    "ConsensusVerdict",
    "ContradictionFinding",
    "DatasetProfile",
    "DefinitionCard",
    "Distribution",
    "DriftFinding",
    "EvidenceRef",
    "Finding",
    "FitnessComponent",
    "FitnessGrade",
    "FitnessScore",
    "GeoResolution",
    "LineageEdge",
    "LineageGraph",
    "LineageNode",
    "NodeKind",
    "ObservationRecord",
    "OriginGroup",
    "ParserInfo",
    "PiiHint",
    "QualityObservation",
    "SchemaMapping",
    "Severity",
    "SourceInfo",
    "TemporalResolution",
    "UnitNorm",
    "UnresolvedField",
]