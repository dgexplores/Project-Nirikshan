"""Shared contract schemas for BDD. These are the typed boundaries between
services, pipelines and storage. Imported by all components.
"""

from bdd_contracts.anomaly import AnomalyFinding, ContradictionFinding, DriftFinding
from bdd_contracts.artifact import ArtifactManifest, ParserInfo, SourceInfo
from bdd_contracts.finding import Claim, EvidenceRef, Finding
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
)

__all__ = [
    "AnomalyFinding",
    "ArtifactManifest",
    "Claim",
    "ColumnProfile",
    "ContradictionFinding",
    "DatasetProfile",
    "DefinitionCard",
    "Distribution",
    "DriftFinding",
    "EvidenceRef",
    "Finding",
    "GeoResolution",
    "ObservationRecord",
    "ParserInfo",
    "PiiHint",
    "QualityObservation",
    "SchemaMapping",
    "Severity",
    "SourceInfo",
    "TemporalResolution",
    "UnitNorm",
]