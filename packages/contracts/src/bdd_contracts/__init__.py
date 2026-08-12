"""Shared contract schemas for BDD. These are the typed boundaries between
services, pipelines and storage. Imported by all components.
"""

from bdd_contracts.artifact import ArtifactManifest, ParserInfo, SourceInfo
from bdd_contracts.finding import Claim, EvidenceRef, Finding
from bdd_contracts.observation import ObservationRecord
from bdd_contracts.profile import (
    ColumnProfile,
    DatasetProfile,
    QualityObservation,
    Severity,
)

__all__ = [
    "ArtifactManifest",
    "Claim",
    "ColumnProfile",
    "DatasetProfile",
    "EvidenceRef",
    "Finding",
    "ObservationRecord",
    "ParserInfo",
    "QualityObservation",
    "Severity",
    "SourceInfo",
]