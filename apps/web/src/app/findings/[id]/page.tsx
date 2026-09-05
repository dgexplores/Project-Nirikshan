"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ArrowIcon, PageHeader } from "@/components/PageChrome";
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
import { EvidenceRows } from "@/components/EvidenceRows";
import { KIND_LABEL } from "@/lib/labels";
import type {
  AnomalyFinding,
  BenfordFinding,
  ConsensusFinding,
  ContradictionFinding,
  DriftFinding,
  UnifiedFinding,
} from "@/lib/types";

const REVIEW_OPTIONS: { value: ReviewDecision; label: string; hint: string }[] = [
  { value: "open", label: "Put back in the queue", hint: "I need to look at this again later" },
  { value: "needs_source_clarification", label: "Need more info from the source", hint: "Ask the publisher what this means" },
  { value: "resolved", label: "Checked, all good", hint: "I verified this against the original source" },
  { value: "not_detectable", label: "Can't tell from this data", hint: "We don't have enough information" },
  { value: "false_positive_after_review", label: "Not actually a problem", hint: "There's a good explanation for this" },
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

  const firstArtifact = finding.artifact_ids[0] ?? "";
  const datasetHref = `/datasets/${encodeURIComponent(firstArtifact)}`;
  const graphHref = `${datasetHref}?tab=lineage&finding=${encodeURIComponent(id)}`;

  return (
    <div>
      <Breadcrumb items={[{ label: "Overview", href: "/" }, { label: "Problems found", href: "/findings" }, { label: finding.title }]} />
      <PageHeader
        eyebrow={
          <>
            <span>{KIND_LABEL[finding.kind] ?? finding.kind}</span>
            <span className="text-[var(--foreground-faint)]">·</span>
            <span>{new Date(finding.created_at).toLocaleString("en-IN")}</span>
          </>
        }
        title={finding.title}
        subtitle={finding.summary}
        meta={
          <>
            <SeverityBadge severity={finding.severity} />
            <ConfidencePill confidence={finding.confidence} />
            <StatusBadge status={finding.status} />
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[var(--foreground-muted)]">Files involved:</span>
            {finding.artifact_ids.map((aid) => (
              <Link
                key={aid}
                href={`/datasets/${encodeURIComponent(aid)}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--low)]/25 bg-[var(--low-soft)] px-3 py-1 text-sm text-[var(--low)] transition hover:border-[var(--low)]/45"
              >
                {aid}
              </Link>
            ))}
          </div>

          <Panel className="overflow-hidden p-0">
            <div className="border-b border-[var(--border)] px-4 py-3">
              <span className="text-sm font-semibold text-[var(--foreground)]">What we found vs. what we expected</span>
            </div>
            <div className="p-4 sm:p-5">
              {finding.kind === "anomaly" && <AnomalyPayloadView finding={finding.payload as AnomalyFinding} />}
              {finding.kind === "drift" && <DriftPayloadView finding={finding.payload as DriftFinding} />}
              {finding.kind === "contradiction" && <ContradictionPayloadView finding={finding.payload as ContradictionFinding} />}
              {finding.kind === "consensus" && <ConsensusPayloadView finding={finding.payload as ConsensusFinding} />}
              {finding.kind === "benford" && <BenfordPayloadView finding={finding.payload as BenfordFinding} />}
              {!["anomaly", "drift", "contradiction", "consensus", "benford"].includes(finding.kind) && (
                <pre className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 text-xs leading-relaxed text-[var(--foreground-muted)]">
                  {JSON.stringify(finding.payload, null, 2)}
                </pre>
              )}
            </div>
          </Panel>

          <p className="mt-3 rounded-xl bg-[var(--medium-soft)] px-4 py-3 text-sm leading-relaxed text-[var(--foreground)]">
            <strong className="font-semibold text-[var(--medium)]">What this means: </strong>
            This might be worth a closer look. We&apos;re not saying anyone did anything wrong, just flagging it for you to check. If this turns out to be serious, please double-check it before sharing with others.
          </p>

          <ol className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              { n: "1", label: "Exact rows", hint: "shown below", href: undefined },
              { n: "2", label: "Open the file", hint: "full context", href: datasetHref },
              { n: "3", label: "Pinpoint on graph", hint: "how we got here", href: graphHref },
            ].map((s) => (
              <li key={s.n}>
                {s.href ? (
                  <Link href={s.href} className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 transition hover:border-[var(--brand)]/30 hover:bg-[var(--brand-soft)]">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-xs font-bold text-white">{s.n}</span>
                    <span>
                      <span className="block text-sm font-medium leading-tight text-[var(--foreground)]">{s.label}</span>
                      <span className="block text-xs leading-tight text-[var(--foreground-faint)]">{s.hint}</span>
                    </span>
                  </Link>
                ) : (
                  <span className="flex items-center gap-2.5 rounded-xl border border-[var(--brand)]/25 bg-[var(--brand-soft)] px-3.5 py-2.5">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-xs font-bold text-white">{s.n}</span>
                    <span>
                      <span className="block text-sm font-medium leading-tight text-[var(--foreground)]">{s.label}</span>
                      <span className="block text-xs leading-tight text-[var(--foreground-faint)]">{s.hint}</span>
                    </span>
                  </span>
                )}
              </li>
            ))}
          </ol>

          <div className="mt-3">
            <EvidenceRows findingId={id} datasetHref={datasetHref} graphHref={graphHref} />
          </div>

          <Link
            href={`/datasets/${encodeURIComponent(finding.artifact_ids[0] ?? "")}`}
            className="mt-3 flex items-center justify-between rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--foreground-muted)] transition hover:bg-[var(--background)] lg:hidden"
          >
            <span>See where this came from</span>
            <ArrowIcon className="size-4" />
          </Link>
        </motion.div>

        <aside className="space-y-4">
          <Panel className="p-4">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Files involved</h3>
            <ul className="mt-3 space-y-2">
              {finding.artifact_ids.map((aid) => (
                <li key={aid}>
                  <Link
                    href={`/datasets/${encodeURIComponent(aid)}`}
                    className="block rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--low)] transition hover:border-[var(--low)]/35 hover:bg-[var(--low-soft)]"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate">{aid}</span>
                      <ArrowIcon className="size-3.5 shrink-0 text-[var(--foreground-faint)]" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs leading-relaxed text-[var(--foreground-faint)]">Each one is a verified file, not just a name.</p>
          </Panel>

          <Panel className="p-4">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">What do you want to do?</h3>
            {finding.reviewed_at && (
              <p className="mt-2.5 rounded-lg border border-[var(--good)]/20 bg-[var(--good-soft)] px-3 py-2 text-xs leading-relaxed text-[var(--good)]">
                Reviewed {new Date(finding.reviewed_at).toLocaleString("en-IN")}
                {finding.reviewer_note ? ` — "${finding.reviewer_note}"` : ""}
              </p>
            )}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note (optional), what did you check?"
              rows={3}
              className="mt-3 w-full resize-none rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm leading-relaxed placeholder:text-[var(--foreground-faint)] focus:border-[var(--brand)]/40 focus:outline-none"
            />
            <div className="mt-3 space-y-1.5">
              {REVIEW_OPTIONS.filter((o) => o.value !== finding.status).map((opt) => (
                <Button
                  key={opt.value}
                  variant="ghost"
                  disabled={saving !== null}
                  onClick={() => review(opt.value)}
                  title={opt.hint}
                  className="w-full justify-between rounded-xl px-3.5 py-2.5 text-left text-sm hover:border-[var(--brand)]/25 hover:bg-[var(--brand-soft)]"
                >
                  <span>
                    <span className="block font-medium leading-none">{opt.label}</span>
                    <span className="mt-1 block text-xs font-normal leading-none text-[var(--foreground-faint)]">{opt.hint}</span>
                  </span>
                  {saving === opt.value ? <Spinner className="size-3.5" /> : <ArrowIcon className="size-3.5 text-[var(--brand)]" />}
                </Button>
              ))}
            </div>
          </Panel>
        </aside>
      </div>
    </div>
  );
}
