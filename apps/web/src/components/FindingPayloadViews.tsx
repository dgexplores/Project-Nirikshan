"use client";

import { motion } from "framer-motion";
import type {
  AnomalyFinding,
  BenfordFinding,
  ConsensusFinding,
  ContradictionFinding,
  DriftFinding,
} from "@/lib/types";
import { HashText } from "./PageChrome";
import { GATE_LABEL, GATE_STATE_LABEL } from "@/lib/labels";

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-[var(--border)] py-3 last:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="shrink-0 text-sm text-[var(--foreground-muted)]">{label}</span>
      <span className="text-left text-sm text-[var(--foreground)] sm:text-right">{value}</span>
    </div>
  );
}

export function AnomalyPayloadView({ finding }: { finding: AnomalyFinding }) {
  const scale = Math.max(Math.abs(finding.observed), Math.abs(finding.expected), 1);
  const pct = (v: number) => `${Math.max((Math.abs(v) / scale) * 100, 4)}%`;
  const delta = finding.observed - finding.expected;
  const deltaPct = finding.expected !== 0 ? (delta / Math.abs(finding.expected)) * 100 : 0;
  const sliceText = Object.entries(finding.slice)
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join(", ");
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-[1.1fr_1fr_auto]">
        <div className="rounded-xl border border-[var(--high)]/25 bg-[var(--high-soft)] p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--high)]/80">What we found</div>
          <div className="mt-1 text-2xl font-bold tracking-tight text-[var(--high)]">{finding.observed.toLocaleString("en-IN")}</div>
          <div className="mt-1 text-xs text-[var(--foreground-faint)]">{sliceText || "Overall"}</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">What we expected</div>
          <div className="mt-1 text-2xl font-bold tracking-tight text-[var(--foreground)]">{finding.expected.toLocaleString("en-IN")}</div>
          <div className="mt-1 text-xs text-[var(--foreground-faint)]">based on similar rows</div>
        </div>
        <div className="flex flex-col justify-center rounded-xl border border-[var(--brand)]/20 bg-[var(--brand-soft)] px-4 py-4 sm:min-w-[140px]">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--brand)]/80">Difference</div>
          <div className={`mt-1 text-lg font-bold ${delta >= 0 ? "text-[var(--brand)]" : "text-[var(--low)]"}`}>
            {delta >= 0 ? "+" : ""}
            {delta.toLocaleString("en-IN")}
          </div>
          <div className="text-xs text-[var(--foreground-faint)]">{deltaPct >= 0 ? "+" : ""}{deltaPct.toFixed(0)}% off</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-3 text-xs text-[var(--foreground-faint)]">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-1.5 w-3 rounded-full bg-[var(--border-strong)]" /> expected</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-1.5 w-3 rounded-full bg-[var(--brand)]" /> found</span>
        </div>
        <div className="space-y-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-[var(--background)]">
            <motion.div initial={{ width: 0 }} animate={{ width: pct(finding.expected) }} transition={{ duration: 0.6 }} className="h-full rounded-full bg-[var(--border-strong)]" />
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--background)]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: pct(finding.observed) }}
              transition={{ delay: 0.12, type: "spring", stiffness: 70 }}
              className="h-full rounded-full bg-[var(--brand)]"
            />
          </div>
        </div>
      </div>

      {finding.caveats.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">Worth knowing</div>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--foreground-muted)]">{finding.caveats.join(" · ")}</p>
        </div>
      )}
    </div>
  );
}

export function DriftPayloadView({ finding }: { finding: DriftFinding }) {
  const before = finding.before_definition as Record<string, string | null>;
  const after = finding.after_definition as Record<string, string | null>;
  const changedUnit = before.unit !== after.unit;
  const changedDenom = before.denominator !== after.denominator;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
        <div className="rounded-xl border border-[var(--border)] bg-white p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">Before</div>
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between gap-2"><span className="text-[var(--foreground-faint)]">unit</span> <span className="text-[var(--foreground)]">{before.unit ?? "—"}</span></div>
            <div className="flex justify-between gap-2"><span className="text-[var(--foreground-faint)]">measured per</span> <span className="text-[var(--foreground)]">{before.denominator ?? "—"}</span></div>
          </div>
          <p className="mt-3 border-t border-[var(--border)] pt-3 text-sm leading-relaxed text-[var(--foreground-muted)]">{before.operational_definition}</p>
        </div>
        <div className="hidden items-center md:flex">
          <span className="rounded-full border border-[var(--medium)]/25 bg-[var(--medium-soft)] px-2.5 py-1 text-xs font-medium text-[var(--medium)]" aria-hidden>
            changed to
          </span>
        </div>
        <div className={`rounded-xl border p-4 ${changedUnit || changedDenom ? "border-[var(--medium)]/25 bg-[var(--medium-soft)]" : "border-[var(--border)] bg-white"}`}>
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">After</div>
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between gap-2"><span className="text-[var(--foreground-faint)]">unit</span> <span className={changedUnit ? "font-semibold text-[var(--medium)]" : "text-[var(--foreground)]"}>{after.unit ?? "—"}</span></div>
            <div className="flex justify-between gap-2"><span className="text-[var(--foreground-faint)]">measured per</span> <span className={changedDenom ? "font-semibold text-[var(--high)]" : "text-[var(--foreground)]"}>{after.denominator ?? "—"}</span></div>
          </div>
          <p className="mt-3 border-t border-[var(--border)] pt-3 text-sm leading-relaxed text-[var(--foreground-muted)]">{after.operational_definition}</p>
        </div>
      </div>

      <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-white px-4">
        <Row label="What changed" value={<span className="capitalize">{finding.drift_type?.replaceAll("_", " ") ?? "—"}</span>} />
        <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-[var(--foreground-muted)]">How big a change</span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-1.5 w-28 overflow-hidden rounded-full bg-[var(--background)]">
              <motion.span initial={{ width: 0 }} animate={{ width: `${finding.semantic_impact * 100}%` }} transition={{ duration: 0.7, delay: 0.15 }} className="block h-full rounded-full bg-[var(--medium)]" />
            </span>
            <span className="text-sm text-[var(--foreground)]">{(finding.semantic_impact * 100).toFixed(0)}%</span>
          </span>
        </div>
        <Row label="Can we still compare these?" value={<span className="capitalize">{GATE_STATE_LABEL[finding.comparability_decision] ?? finding.comparability_decision.replaceAll("_", " ")}</span>} />
      </div>
    </div>
  );
}

export function ContradictionPayloadView({ finding }: { finding: ContradictionFinding }) {
  const va = Number(finding.claim_a.value);
  const vb = Number(finding.claim_b.value);
  const max = Math.max(va, vb, 1);
  return (
    <div className="space-y-5">
      <div className="space-y-3 rounded-xl border border-[var(--border)] bg-white p-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">Source A vs Source B</div>
        {[finding.claim_a, finding.claim_b].map((claim, i) => {
          const val = Number(claim.value);
          const isA = i === 0;
          const color = isA ? "var(--low)" : "var(--medium)";
          return (
            <div key={i} className="rounded-lg border p-3" style={{ borderColor: `${color}40`, background: `color-mix(in srgb, ${color} 6%, white)` }}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <HashText hash={String(claim.source_id)} />
                <span className="text-sm font-bold" style={{ color }}>
                  {val.toLocaleString("en-IN")} <span className="text-xs font-normal text-[var(--foreground-faint)]">{String(claim.metric)}</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--background)]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(val / max) * 100}%` }}
                  transition={{ duration: 0.65, delay: i * 0.1 }}
                  className="h-full rounded-full"
                  style={{ background: color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-white px-4">
        <Row label="Do they agree?" value={<span className="capitalize font-semibold">{finding.reconciliation_status.replaceAll("_", " ")}</span>} />
        {Object.entries(finding.alignment_tests).map(([dim, state]) => (
          <Row key={dim} label={GATE_LABEL[dim] ?? dim} value={<span>{GATE_STATE_LABEL[String(state)] ?? String(state).replaceAll("_", " ")}</span>} />
        ))}
      </div>

      <div className="rounded-xl border border-[var(--medium)]/20 bg-[var(--medium-soft)] px-4 py-3">
        <div className="text-xs font-semibold uppercase tracking-wide text-[var(--medium)]/80">Possible reasons, please check</div>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm leading-relaxed text-[var(--foreground)]">
          {finding.possible_explanations.map((ex, i) => (
            <li key={i}>{ex}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function BenfordPayloadView({ finding }: { finding: BenfordFinding }) {
  const maxShare = Math.max(...finding.digits.map((d) => Math.max(d.observed_share, d.expected_share)));
  const pct = (v: number) => `${Math.max((v / maxShare) * 100, 4)}%`;
  const conformityLabel = finding.conformity === "nonconformity" ? "Very unusual" : finding.conformity === "marginal" ? "Somewhat unusual" : "Slightly unusual";
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-white p-3.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">Pattern check</div>
          <div className={`mt-1 text-lg font-semibold ${finding.conformity === "nonconformity" ? "text-[var(--critical)]" : finding.conformity === "marginal" ? "text-[var(--high)]" : "text-[var(--medium)]"}`}>{conformityLabel}</div>
          <div className="text-xs text-[var(--foreground-faint)]">how far from a natural pattern</div>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-white p-3.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-[var(--foreground-faint)]">Numbers checked</div>
          <div className="mt-1 text-lg font-semibold text-[var(--foreground)]">{finding.n_values.toLocaleString("en-IN")}</div>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-white p-4">
        <p className="mb-3 text-sm leading-relaxed text-[var(--foreground-muted)]">
          Real-world numbers usually start with certain digits (like 1) more often than others. Here&apos;s how the first digit of each number in this column compares to that natural pattern.
        </p>
        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-[var(--foreground-faint)]">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-3 rounded-full bg-[var(--border-strong)]" /> natural pattern</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-3 rounded-full bg-[var(--brand)]" /> found in your data</span>
        </div>
        <div className="space-y-2">
          {finding.digits.map((d, i) => (
            <div key={d.digit} className="flex items-center gap-2 text-xs">
              <span className="w-3 shrink-0 text-right text-[var(--foreground-muted)]">{d.digit}</span>
              <div className="relative h-3.5 flex-1 overflow-hidden rounded bg-[var(--background)]">
                <motion.div initial={{ width: 0 }} animate={{ width: pct(d.expected_share) }} transition={{ duration: 0.45 }} className="absolute inset-y-0 left-0 rounded bg-[var(--border-strong)]" />
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: pct(d.observed_share) }}
                  transition={{ duration: 0.55, delay: i * 0.04 }}
                  className={`absolute inset-y-0 left-0 rounded ${d.excess > 0.02 ? "bg-[var(--high)]" : d.excess < -0.05 ? "bg-[var(--low)]" : "bg-[var(--brand)]"}`}
                />
              </div>
              <span className={`w-14 shrink-0 text-right tabular-nums ${d.excess > 0 ? "text-[var(--high)]" : "text-[var(--foreground-faint)]"}`}>
                {d.excess >= 0 ? "+" : ""}{(d.excess * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {finding.caveats.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-3">
          <p className="text-sm leading-relaxed text-[var(--foreground-muted)]">This is a screening signal, not proof of a problem. It doesn&apos;t apply to IDs, phone numbers, or dates, and it&apos;s worth checking what this column actually means before acting on it.</p>
        </div>
      )}
    </div>
  );
}

export function ConsensusPayloadView({ finding }: { finding: ConsensusFinding }) {
  const suspected = finding.verdict === "shared_origin_suspected";
  return (
    <div className="space-y-5">
      <div className={`rounded-xl border p-4 ${suspected ? "border-[var(--medium)]/25 bg-[var(--medium-soft)]" : "border-[var(--good)]/25 bg-[var(--good-soft)]"}`}>
        <div className={`text-[15px] font-semibold ${suspected ? "text-[var(--medium)]" : "text-[var(--good)]"}`}>
          {suspected
            ? `Looks like ${finding.apparent_sources} source${finding.apparent_sources === 1 ? "" : "s"}, but ${finding.distinct_origins === 1 ? "it really traces back to just 1 original source" : `they really trace back to only ${finding.distinct_origins} original sources`}`
            : "These really are independent sources, a good sign"}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/10">
          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(finding.diversity_ratio * 100, 4)}%` }} transition={{ duration: 0.8, delay: 0.12 }} className={`h-full rounded-full ${suspected ? "bg-[var(--medium)]" : "bg-[var(--good)]"}`} />
        </div>
        <div className="mt-1.5 text-sm text-[var(--foreground-muted)]">Independence score: {(finding.diversity_ratio * 100).toFixed(0)}% (higher is better)</div>
      </div>
      <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-white px-4">
        <Row label="What's being measured" value={finding.metric} />
        {finding.origin_groups.map((group) => (
          <Row key={group.origin_artifact_id} label={<HashText hash={group.origin_artifact_id} />} value={<span className="text-sm text-[var(--foreground-muted)]">{group.members.length} report(s) trace here</span>} />
        ))}
      </div>
    </div>
  );
}
