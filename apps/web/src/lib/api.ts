import type {
  AskResponse,
  CompareResponse,
  DatasetProfile,
  FitnessScore,
  FindingsPage,
  Job,
  LineageGraph,
  Manifest,
  UnifiedFinding,
} from "./types";

const BASE = "/api/backend";

export class ApiError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** The API host itself is not answering, as opposed to the API answering with
 *  an error of its own. ErrorState matches on this exact string to show the
 *  offline notice, so the two files share it rather than sniffing text. */
export const BACKEND_DOWN = "The API host is not responding.";

/** True when the failure came from the platform rather than the application.
 *
 *  This API always answers with its own envelope, `{error: {code, message}}`,
 *  and FastAPI's own 404 for an unknown route carries `detail`. A body with
 *  neither did not come from this service at all, so a 404 shaped like that
 *  means the host has no application to route to. The gateway range means the
 *  platform could not reach the container either way. */
function isHostFailure(status: number, body: unknown): boolean {
  if (status === 502 || status === 503 || status === 504) return true;
  if (status !== 404) return false;
  const data = (body ?? {}) as { error?: unknown; detail?: unknown };
  return data.error === undefined && data.detail === undefined;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, init);
  } catch {
    // No response at all: offline, DNS failure, or nothing listening.
    throw new ApiError("backend_unreachable", BACKEND_DOWN);
  }
  if (!res.ok) {
    let code = String(res.status);
    let message = res.statusText || "request failed";
    let body: unknown = null;
    try {
      body = await res.json();
      const data = body as { error?: { code?: string; message?: string } };
      if (data?.error?.message) {
        message = data.error.message;
        if (data.error.code) code = data.error.code;
      }
    } catch {
      // A non-JSON body is itself a sign the response came from the host.
    }
    if (isHostFailure(res.status, body)) {
      throw new ApiError("backend_unreachable", BACKEND_DOWN);
    }
    throw new ApiError(code, message);
  }
  return (await res.json()) as T;
}

// ---------- health / dashboard ----------

export function getHealth(): Promise<{ status: string; version?: string }> {
  return request("/health");
}

export interface DashboardSummary {
  artifacts: number;
  rows_total: number;
  bytes_total: number;
  avg_fitness: number | null;
  findings_total: number;
  by_severity: Record<string, number>;
  by_kind: Record<string, number>;
  open_reviews: number;
  recent_findings: {
    id: string;
    kind: string;
    severity: string;
    title: string;
    summary: string;
    status: string;
    created_at: string;
  }[];
  recent_artifacts: {
    artifact_id: string;
    title: string | null;
    row_count: number | null;
    fitness_grade: string | null;
    created_at: string;
  }[];
}

export function getDashboard(): Promise<DashboardSummary> {
  return request<DashboardSummary>("/dashboard/summary");
}

export function seedDemo(): Promise<{ seeded: string[]; skipped: string[]; new_findings: number }> {
  return request("/seed/demo", { method: "POST" });
}

// ---------- artifacts ----------

export interface ArtifactSummary {
  artifact_id: string;
  source_id: string;
  title: string | null;
  sha256: string;
  media_type: string;
  byte_size: number;
  release_date: string | null;
  row_count: number | null;
  column_count: number | null;
  quality_flag_count: number;
  fitness_score: number | null;
  fitness_grade: string | null;
  created_at: string;
}

export function listArtifacts(): Promise<{ total: number; items: ArtifactSummary[] }> {
  return request("/artifacts");
}

export function getManifest(id: string): Promise<Manifest> {
  return request(`/artifacts/${encodeURIComponent(id)}/manifest`);
}

export function getProfile(id: string): Promise<DatasetProfile> {
  return request(`/artifacts/${encodeURIComponent(id)}/profile`);
}

export function getFitness(id: string): Promise<FitnessScore> {
  return request(`/artifacts/${encodeURIComponent(id)}/fitness`);
}

export function getLineage(id: string): Promise<LineageGraph> {
  return request(`/artifacts/${encodeURIComponent(id)}/lineage`);
}

export function analyzeArtifact(id: string): Promise<{ artifact_id: string; findings_written: number }> {
  return request(`/artifacts/${encodeURIComponent(id)}/analyze`, { method: "POST" });
}

export async function uploadArtifact(
  file: File,
  opts: { artifactId: string; sourceId: string; title?: string; releaseDate?: string },
): Promise<{ artifact_id: string; job_id: string }> {
  const params = new URLSearchParams({
    artifact_id: opts.artifactId,
    source_id: opts.sourceId,
  });
  if (opts.title) params.set("title", opts.title);
  if (opts.releaseDate) params.set("release_date", opts.releaseDate);
  const form = new FormData();
  form.append("file", file);
  return request(`/artifacts/ingest?${params.toString()}`, {
    method: "POST",
    body: form,
  });
}

// ---------- jobs ----------

export function getJob(id: string): Promise<Job> {
  return request(`/jobs/${encodeURIComponent(id)}`);
}

export interface StepState {
  name: string;
  status: string;
  detail: string | null;
}

export async function pollJob(
  jobId: string,
  onTick?: (job: Job) => void,
  intervalMs = 900,
  maxTries = 200,
): Promise<Job> {
  for (let i = 0; i < maxTries; i++) {
    const job = await getJob(jobId);
    onTick?.(job);
    if (job.status === "done" || job.status === "failed") return job;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new ApiError("timeout", "job did not finish in time");
}

// ---------- findings ----------

export interface FindingsParams {
  severity?: string;
  kind?: string;
  status?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export function listFindings(params?: FindingsParams): Promise<FindingsPage> {
  const qs = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
    }
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return request(`/findings${suffix}`);
}

export function getFinding(id: string): Promise<UnifiedFinding> {
  return request(`/findings/${encodeURIComponent(id)}`);
}

export interface EvidenceRow {
  _row: number;
  [column: string]: string | number | boolean | null;
}

export interface EvidenceResponse {
  finding_id: string;
  kind: string;
  artifact_id: string | null;
  artifact_ids: string[];
  metric: string | null;
  slice: Record<string, string>;
  columns: string[];
  rows: EvidenceRow[];
  matched: number;
  returned: number;
  truncated: boolean;
  label: string;
  note: string | null;
}

export function getEvidence(id: string, limit = 25): Promise<EvidenceResponse> {
  return request(`/findings/${encodeURIComponent(id)}/evidence?limit=${limit}`);
}

export type ReviewDecision =
  | "open"
  | "needs_source_clarification"
  | "resolved"
  | "not_detectable"
  | "false_positive_after_review";

export function reviewFinding(
  id: string,
  body: { status: ReviewDecision; note?: string },
): Promise<{ id: string; status: string }> {
  return request(`/findings/${encodeURIComponent(id)}/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------- compare ----------

export function compareArtifacts(body: {
  artifact_a: string;
  column_a: string;
  artifact_b: string;
  column_b: string;
}): Promise<CompareResponse> {
  return request("/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------- ask detective ----------

export function askDetective(
  question: string,
  artifactIds?: string[],
): Promise<AskResponse> {
  return request("/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, artifact_ids: artifactIds?.length ? artifactIds : null }),
  });
}
