"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/PageChrome";
import {
  AnomalyPayloadView,
  ConsensusPayloadView,
  ContradictionPayloadView,
  DriftPayloadView,
} from "@/components/FindingPayloadViews";
import { ConfidencePill } from "@/components/ui/ConfidencePill";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Spinner } from "@/components/ui/Spinner";
import { Panel } from "@/components/ui/Panel";
import { getFinding, reviewFinding, type ReviewDecision } from "@/lib/api";
import type {
  AnomalyFinding,
  ConsensusFinding,
  ContradictionFinding,
  DriftFinding,
  UnifiedFinding,
} from "@/lib/types";

const REVIEW_OPTIONS: { value: ReviewDecision; label: string; hint: string }[] = [
  { value: "open", label: "Re-open", hint: "Back into the review queue" },
  { value: "needs_source_clarification", label: "Needs source clarification", hint: "Ask publisher for definitions/metadata" },
  { value: "resolved", label: "Resolved after verification", hint: "Checked against the origin source" },
  { value: "not_detectable", label: "Not detectable", hint: "Documents an access/observability gap" },
  { value: "false_positive_after_review", label: "False positive", hint: "Explained by known context" },
];

export default function FindingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = decodeURIComponent(params.id);

  const [finding, setFinding] = useState<UnifiedFinding | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState<ReviewDecision | null>(null);

  const load = useCallback(() => {
    getFinding(id).then(setFinding).catch((e: Error) => setError(e.message));
  }, [id]);

  useEffect(load, [load]);

  async function review(status: ReviewDecision) {
    setSaving(status);
    try {
      await reviewFinding(id, { status, note: note || undefined });
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(null);
    }
  }

  if (error && !finding) return <ErrorState message={error} onRetry={load} />;
  if (!finding) return <div className="flex justify-center py-32"><Spinner /></div>;

  return (
    <div>
      <PageHeader
        title={finding.title}
        subtitle={`Finding ${finding.id}`}
        actions={
          <>
            <SeverityBadge severity={finding.severity} />
            <ConfidencePill confidence={finding.confidence} />
            <StatusBadge status={finding.status} />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Panel className="mb-4">
            <p className="text-sm leading-relaxed text-white/75">{finding.summary}</p>
          </Panel>

          <Panel>
            {finding.kind === "anomaly" && <AnomalyPayloadView finding={finding.payload as AnomalyFinding} />}
            {finding.kind === "drift" && <DriftPayloadView finding={finding.payload as DriftFinding} />}
            {finding.kind === "contradiction" && <ContradictionPayloadView finding={finding.payload as ContradictionFinding} />}
            {finding.kind === "consensus" && <ConsensusPayloadView finding={finding.payload as ConsensusFinding} />}
            {!["anomaly", "drift", "contradiction", "consensus"].includes(finding.kind) && (
              <pre className="overflow-x-auto rounded-lg bg-black/40 p-4 font-mono text-xs text-white/70">
                {JSON.stringify(finding.payload, null, 2)}
              </pre>
            )}
          </Panel>

          <p className="mt-4 border-l-2 border-[#f59e0b]/50 pl-3 text-xs leading-relaxed text-white/40">
            This is a potential inconsistency flagged for human review. BDD does not declare any source,
            dataset or person wrong. High/critical findings require human confirmation before external sharing.
          </p>
        </motion.div>

        <aside className="space-y-4">
          <Panel>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">Linked artifacts</h3>
            <ul className="mt-3 space-y-2">
              {finding.artifact_ids.map((aid) => (
                <li key={aid}>
                  <Link
                    href={`/datasets/${encodeURIComponent(aid)}`}
                    className="block rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-xs text-[#22d3ee]/85 transition hover:border-[#22d3ee]/40 hover:text-[#22d3ee]"
                  >
                    {aid}
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">Reviewer decision</h3>
            {finding.reviewed_at && (
              <p className="mt-2 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-2.5 py-1.5 text-[11px] text-emerald-400/80">
                reviewed {new Date(finding.reviewed_at).toLocaleString("en-IN")}
                {finding.reviewer_note ? ` · "${finding.reviewer_note}"` : ""}
              </p>
            )}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reviewer note (optional)…"
              rows={2}
              className="mt-3 w-full resize-none rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-xs placeholder:text-white/25 focus:border-[#f59e0b]/50 focus:outline-none"
            />
            <div className="mt-3 space-y-2">
              {REVIEW_OPTIONS.filter((o) => o.value !== finding.status).map((opt) => (
                <Button
                  key={opt.value}
                  variant="ghost"
                  disabled={saving !== null}
                  onClick={() => review(opt.value)}
                  title={opt.hint}
                  className="w-full justify-between text-xs"
                >
                  <span>{opt.label}</span>
                  {saving === opt.value ? <Spinner className="size-3" /> : "→"}
                </Button>
              ))}
            </div>
          </Panel>

          <Panel>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white/40">Trace</h3>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between gap-2"><dt className="text-white/40">Engine</dt><dd className="capitalize">{finding.kind}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-white/40">Detected</dt><dd>{new Date(finding.created_at).toLocaleString("en-IN")}</dd></div>
            </dl>
            <Link href={`/datasets/${encodeURIComponent(finding.artifact_ids[0] ?? "")}`} className="mt-3 block text-xs text-[#22d3ee]/70 hover:text-[#22d3ee]">
              View lineage graph →
            </Link>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
