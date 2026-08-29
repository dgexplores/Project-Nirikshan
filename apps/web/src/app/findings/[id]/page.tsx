"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Breadcrumb } from "@/components/Breadcrumb";
import { PageHeader } from "@/components/PageChrome";
import {
  AnomalyPayloadView,
  BenfordPayloadView,
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
  BenfordFinding,
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
  const router = useRouter();
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
      router.push("/findings");
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
      <Breadcrumb items={[{ label: "Dashboard", href: "/" }, { label: "Findings", href: "/findings" }, { label: finding.id.slice(0, 22) + "…" }]} />
      <PageHeader
        eyebrow={
          <>
            <span className="text-[#f59e0b]">FINDING</span>
            <span className="text-white/20">·</span>
            <span className="font-mono normal-case tracking-tight text-white/45">{finding.id}</span>
            <span className="hidden text-white/20 sm:inline">·</span>
            <span className="hidden capitalize sm:inline">{finding.kind}</span>
            <span className="text-white/20">·</span>
            <span className="font-mono text-[11px] normal-case tracking-tight text-white/30">{new Date(finding.created_at).toLocaleString("en-IN")}</span>
          </>
        }
        title={finding.title}
        subtitle={finding.summary}
        meta={
          <>
            <SeverityBadge severity={finding.severity} />
            <ConfidencePill confidence={finding.confidence} />
            <StatusBadge status={finding.status} />
            <span className="hidden items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 font-mono text-[11px] text-white/40 sm:inline-flex">
              {finding.kind}
            </span>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Evidence delta is the hero – full-width forensic panel */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="min-w-0">
          {/* Evidence locator strip – dominant, not tucked in sidebar */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-widest text-white/35">Evidence locators</span>
            {finding.artifact_ids.map((aid) => (
              <Link
                key={aid}
                href={`/datasets/${encodeURIComponent(aid)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#22d3ee]/20 bg-[#22d3ee]/10 px-2.5 py-1 font-mono text-xs text-[#22d3ee] transition hover:border-[#22d3ee]/35 hover:bg-[#22d3ee]/15"
              >
                <span className="size-1 rounded-full bg-[#22d3ee]" aria-hidden />
                {aid}
              </Link>
            ))}
            <Link href={`/datasets/${encodeURIComponent(finding.artifact_ids[0] ?? "")}`} className="ml-auto hidden text-xs text-white/30 hover:text-white/60 sm:inline">
              View lineage graph →
            </Link>
          </div>

          <Panel className="overflow-hidden p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-white/[0.015] px-4 py-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Evidence vs expected — delta is the decision surface</span>
              <span className="rounded bg-[#f59e0b]/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide text-[#f59e0b] ring-1 ring-[#f59e0b]/15">
                {finding.severity} · {finding.confidence} confidence
              </span>
            </div>
            <div className="p-4 sm:p-5">
              {finding.kind === "anomaly" && <AnomalyPayloadView finding={finding.payload as AnomalyFinding} />}
              {finding.kind === "drift" && <DriftPayloadView finding={finding.payload as DriftFinding} />}
              {finding.kind === "contradiction" && <ContradictionPayloadView finding={finding.payload as ContradictionFinding} />}
              {finding.kind === "consensus" && <ConsensusPayloadView finding={finding.payload as ConsensusFinding} />}
              {finding.kind === "benford" && <BenfordPayloadView finding={finding.payload as BenfordFinding} />}
              {!["anomaly", "drift", "contradiction", "consensus", "benford"].includes(finding.kind) && (
                <pre className="overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-4 font-mono text-xs leading-relaxed text-white/65">
                  {JSON.stringify(finding.payload, null, 2)}
                </pre>
              )}
            </div>
          </Panel>

          <p className="mt-3 border-l-2 border-[#f59e0b]/40 bg-[#f59e0b]/5 px-3 py-2.5 text-xs leading-relaxed text-white/45">
            <strong className="font-semibold text-[#f59e0b]">Forensic note:</strong> This is a potential inconsistency flagged for human review. BDD does not declare any source, dataset or person wrong. <span className="text-white/60">High/critical requires human confirmation before external sharing.</span> Reproduce via evidence query + hash above.
          </p>

          {/* Mobile lineage shortcut */}
          <Link
            href={`/datasets/${encodeURIComponent(finding.artifact_ids[0] ?? "")}`}
            className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-white/60 transition hover:bg-white/[0.04] sm:hidden"
          >
            <span>View evidence lineage →</span>
            <span aria-hidden>↗</span>
          </Link>
        </motion.div>

        <aside className="space-y-4">
          <Panel className="p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Linked artifacts — tap for lineage</h3>
            <ul className="mt-3 space-y-2">
              {finding.artifact_ids.map((aid) => (
                <li key={aid}>
                  <Link
                    href={`/datasets/${encodeURIComponent(aid)}`}
                    className="block rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 font-mono text-xs text-[#22d3ee]/85 transition hover:border-[#22d3ee]/35 hover:bg-[#22d3ee]/5 hover:text-[#22d3ee]"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate">{aid}</span>
                      <span aria-hidden className="shrink-0 text-white/20">
                        ↗
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] leading-relaxed text-white/25">Each locator is a content hash — evidence, not a filename.</p>
          </Panel>

          <Panel className="p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Reviewer decision — next action is primary</h3>
            {finding.reviewed_at && (
              <p className="mt-2.5 rounded-lg border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-xs leading-relaxed text-emerald-400/80">
                reviewed {new Date(finding.reviewed_at).toLocaleString("en-IN")}
                {finding.reviewer_note ? ` — “${finding.reviewer_note}”` : ""}
              </p>
            )}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reviewer note (optional) — what did you check? Leave trace for next auditor…"
              rows={3}
              className="mt-3 w-full resize-none rounded-xl border border-white/12 bg-black/30 px-3 py-2.5 text-xs leading-relaxed placeholder:text-white/25 focus:border-[#f59e0b]/35 focus:outline-none"
            />
            <div className="mt-3 space-y-1.5">
              {REVIEW_OPTIONS.filter((o) => o.value !== finding.status).map((opt) => (
                <Button
                  key={opt.value}
                  variant="ghost"
                  disabled={saving !== null}
                  onClick={() => review(opt.value)}
                  title={opt.hint}
                  className="w-full justify-between rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-left text-xs hover:border-[#f59e0b]/25 hover:bg-[#f59e0b]/5"
                >
                  <span>
                    <span className="block font-medium leading-none">{opt.label}</span>
                    <span className="mt-0.5 block text-[11px] font-normal leading-none text-white/35">{opt.hint}</span>
                  </span>
                  {saving === opt.value ? <Spinner className="size-3.5" /> : <span className="text-[#f59e0b]">→</span>}
                </Button>
              ))}
            </div>
            <p className="mt-2 text-center text-[11px] text-white/25">Status + next action preserved at 390px — decision moves it out of the queue.</p>
          </Panel>

          <Panel className="p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-white/40">Trace</h3>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between gap-2">
                <dt className="text-white/40">Engine</dt>
                <dd className="font-mono capitalize text-white/75">{finding.kind}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-white/40">Detected</dt>
                <dd className="font-mono text-white/55">{new Date(finding.created_at).toLocaleDateString("en-IN")}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-white/40">ID</dt>
                <dd className="max-w-[14ch] truncate font-mono text-[11px] text-white/35" title={finding.id}>
                  {finding.id}
                </dd>
              </div>
            </dl>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
