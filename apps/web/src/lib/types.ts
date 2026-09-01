export interface Manifest {
  artifact_id: string;
  source_url?: string | null;
  retrieved_at: string;
  sha256: string;
  media_type: string;
  byte_size: number;
  parser: {
    name: string;
    version: string;
    config_hash: string;
  };
  release_date?: string | null;
  raw_uri: string;
  supersedes_artifact_id?: string | null;
  source: {
    source_id: string;
    publisher?: string | null;
    official_title?: string | null;
  };
}

export interface PiiHint {
  hint_type: string;
  column: string;
  matched_values: number;
  sample_matches: string[];
}

export interface Distribution {
  p5: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p95: number | null;
  skewness: number | null;
}

export interface ColumnProfile {
  name: string;
  dtype: string;
  /** Set by the backend. Optional because profiles stored before it existed
   *  have no such key; call sites fall back to the dtype check. */
  is_numeric?: boolean;
  is_metric?: boolean;
  null_count: number;
  null_ratio: number;
  unique_count: number;
  min?: number | null;
  max?: number | null;
  mean?: number | null;
  stddev?: number | null;
  distribution?: Distribution | null;
  pii_hints: PiiHint[];
  top_values: Record<string, unknown>[];
  sample_values: unknown[];
}

export type QualitySeverity = "info" | "low" | "medium" | "high";

export interface QualityObservation {
  code: string;
  severity: QualitySeverity;
  column?: string | null;
  description: string;
  evidence: Record<string, unknown>;
}

export interface DatasetProfile {
  dataset_id: string;
  artifact_id: string;
  row_count: number;
  column_count: number;
  columns: ColumnProfile[];
  duplicate_rows: number;
  quality_observations: QualityObservation[];
  candidate_keys: string[][];
  profile_version: string;
}

export type Severity = "info" | "low" | "medium" | "high" | "critical";
export type Confidence = "low" | "moderate" | "high";

export type DriftType =
  | "definition"
  | "unit"
  | "denominator"
  | "scope"
  | "geography";

export type ComparabilityDecision = "comparable" | "partial" | "not_comparable";

export interface DriftFinding {
  finding_id: string;
  concept_id: string;
  before_definition: Record<string, unknown>;
  after_definition: Record<string, unknown>;
  drift_type: DriftType | null;
  impact_scope: string[];
  comparability_decision: ComparabilityDecision;
  evidence: string[];
  severity: Severity;
  semantic_impact: number;
  created_at: string;
}

export interface AnomalyFinding {
  finding_id: string;
  metric: string;
  slice: Record<string, unknown>;
  observed: number;
  expected: number;
  baseline: number;
  method: string;
  score: number;
  severity: Severity;
  confidence: Confidence;
  evidence_query: string;
  caveats: string[];
  created_at: string;
}

export type ReconciliationStatus =
  | "conflict"
  | "explainable"
  | "not_comparable";

export interface ContradictionFinding {
  finding_id: string;
  claim_a: Record<string, unknown>;
  claim_b: Record<string, unknown>;
  reconciliation_status: ReconciliationStatus;
  delta?: number | null;
  alignment_tests: Record<string, unknown>;
  possible_explanations: string[];
  evidence: string[];
  severity: Severity;
  confidence: Confidence;
  created_at: string;
}

export type ConsensusVerdict =
  | "independent_corroboration"
  | "shared_origin_suspected";

export interface ConsensusFinding {
  finding_id: string;
  metric: string;
  apparent_sources: number;
  distinct_origins: number;
  diversity_ratio: number;
  verdict: ConsensusVerdict;
  origin_groups: { origin_artifact_id: string; members: string[] }[];
  severity: Severity;
  confidence: Confidence;
  created_at: string;
}

export type BenfordConformity = "close" | "acceptable" | "marginal" | "nonconformity";

export interface DigitDeviation {
  digit: number;
  observed_share: number;
  expected_share: number;
  excess: number;
}

export interface BenfordFinding {
  finding_id: string;
  column: string;
  n_values: number;
  mad: number;
  conformity: BenfordConformity;
  digits: DigitDeviation[];
  caveats: string[];
  severity: Severity;
  confidence: Confidence;
  created_at: string;
}

export interface FitnessScore {
  artifact_id: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  components: { name: string; score: number; weight: number; detail: string }[];
  computed_at: string;
}

export type LineageNodeKind =
  | "raw_artifact"
  | "parser"
  | "profile"
  | "rule"
  | "finding";

export interface LineageNode {
  id: string;
  kind: LineageNodeKind;
  label: string;
  detail?: string;
}

export interface LineageEdge {
  from: string;
  to: string;
  relation: string;
}

export interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
  generated_at: string;
}

export type UnifiedFindingKind =
  | "anomaly"
  | "contradiction"
  | "drift"
  | "consensus"
  | "benford"
  | "quality";

export type FindingStatus =
  | "open"
  | "needs_source_clarification"
  | "resolved"
  | "not_detectable"
  | "false_positive_after_review";

export type FindingPayload =
  | AnomalyFinding
  | ContradictionFinding
  | DriftFinding
  | ConsensusFinding
  | BenfordFinding
  | QualityObservation;

export interface UnifiedFinding {
  id: string;
  artifact_ids: string[];
  kind: UnifiedFindingKind;
  severity: Severity;
  confidence: Confidence;
  status: FindingStatus;
  title: string;
  summary: string;
  payload: FindingPayload;
  created_at: string;
  reviewed_at?: string | null;
  reviewer_note?: string | null;
}

export interface FindingsPage {
  total: number;
  items: UnifiedFinding[];
}

export interface JobStep {
  name: string;
  status: "pending" | "running" | "done" | "failed";
  detail?: string;
}

export interface Job {
  job_id: string;
  kind: string;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  steps: JobStep[];
  result?: Record<string, unknown> | null;
  error?: string | null;
  created_at: string;
}

export interface CompareGate {
  dimension: string;
  state: string;
  reason: string;
}

export interface CompareResponse {
  overall: string;
  gates: CompareGate[];
  totals: Record<string, { column: string; total: number }>;
  contradiction: ContradictionFinding;
  drift_findings: DriftFinding[];
}

export interface AskCitation {
  ref: string;
  artifact_id: string;
  locator: string;
  snippet: string;
}

export type AskMode = "llm" | "deterministic" | "refusal";

export interface AskResponse {
  question: string;
  answer: string;
  mode: AskMode;
  confidence: Confidence;
  citations: AskCitation[];
  suggested_next: string[];
}
