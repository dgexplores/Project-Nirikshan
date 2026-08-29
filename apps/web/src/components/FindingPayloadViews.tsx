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

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-white/[0.06] py-2.5 last:border-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <span className="shrink-0 font-mono text-[11px] uppercase tracking-wider text-white/35">{label}</span>
      <span className="text-left font-mono text-xs text-white/80 sm:text-right">{value}</span>
    </div>
  );
}

export function AnomalyPayloadView({ finding }: { finding: AnomalyFinding }) {
  const scale = Math.max(Math.abs(finding.observed), Math.abs(finding.expected), 1);
  const pct = (v: number) => `${Math.max((Math.abs(v) / scale) * 100, 4)}%`;
  const delta = finding.observed - finding.expected;
  const deltaPct = finding.expected !== 0 ? (delta / Math.abs(finding.expected)) * 100 : 0;
  const sliceText = Object.entries(finding.slice)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(" · ");
  return (
    <div className="space-y-5">
      {/* Dominant delta – evidence vs expected */}
      <div className="grid gap-3 sm:grid-cols-[1.1fr_1fr_auto]">
        <div className="rounded-xl border border-[#fb923c]/25 bg-[#fb923c]/5 p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#fb923c]/80">Observed — evidence</div>
          <div className="mt-1 font-mono text-2xl font-bold tracking-tight text-[#fb923c]">{finding.observed.toLocaleString("en-IN")}</div>
          <div className="mt-1 font-mono text-[11px] text-white/35">slice · {sliceText || "*"}</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-white/40">Expected — baseline</div>
          <div className="mt-1 font-mono text-2xl font-bold tracking-tight text-white/85">{finding.expected.toLocaleString("en-IN")}</div>
          <div className="mt-1 font-mono text-[11px] text-white/30">method · {finding.method}</div>
        </div>
        <div className="flex flex-col justify-center rounded-xl border border-[#f59e0b]/20 bg-[#f59e0b]/5 px-4 py-4 sm:min-w-[140px]">
          <div className="font-mono text-[10px] uppercase tracking-widest text-[#f59e0b]/80">Delta</div>
          <div className={`mt-1 font-mono text-lg font-bold ${delta >= 0 ? "text-[#f59e0b]" : "text-[#38bdf8]"}`}>
            {delta >= 0 ? "+" : ""}
            {delta.toLocaleString("en-IN")}
          </div>
          <div className="font-mono text-xs text-white/40">{deltaPct >= 0 ? "+" : ""}{deltaPct.toFixed(1)}% · score {finding.score}</div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 font-mono text-[11px] text-white/30">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-1.5 w-3 rounded-full bg-white/25" /> expected</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-1.5 w-3 rounded-full bg-[#f59e0b]" /> observed</span>
          <span className="ml-auto text-white/25">scale · absolute</span>
        </div>
        <div className="space-y-1.5">
          <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div initial={{ width: 0 }} animate={{ width: pct(finding.expected) }} transition={{ duration: 0.6 }} className="h-full rounded-full bg-white/35" />
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: pct(finding.observed) }}
              transition={{ delay: 0.12, type: "spring", stiffness: 70 }}
              className="h-full rounded-full bg-[#f59e0b]"
            />
          </div>
        </div>
      </div>

      <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06] bg-white/[0.015] px-4">
        <Row label="Reproducible via" value={<code className="break-all rounded bg-black/40 px-1.5 py-0.5 font-mono text-[11px] text-[#22d3ee]">{finding.evidence_query}</code>} />
        <Row label="Baseline" value={finding.baseline.toLocaleString("en-IN")} />
        {finding.caveats.length > 0 && <Row label="Caveats" value={<span className="font-sans text-xs leading-relaxed text-white/55">{finding.caveats.join(" · ")}</span>} />}
      </div>
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
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <div className="font-mono text-[10px] uppercase tracking-widest text-white/35">Version A — before</div>
          <div className="mt-2 space-y-1 font-mono text-xs">
            <div className="flex justify-between gap-2"><span className="text-white/35">unit</span> <span className="text-white/80">{before.unit ?? "—"}</span></div>
            <div className="flex justify-between gap-2"><span className="text-white/35">denominator</span> <span className="text-white/80">{before.denominator ?? "—"}</span></div>
          </div>
          <p className="mt-3 border-t border-white/[0.06] pt-3 font-sans text-xs leading-relaxed text-white/60">{before.operational_definition}</p>
        </div>
        <div className="hidden items-center md:flex">
          <span className="rounded-full border border-[#f59e0b]/20 bg-[#f59e0b]/10 px-2 py-1 font-mono text-xs text-[#f59e0b]" aria-hidden>
            drift →
          </span>
        </div>
        <div className={`rounded-xl border p-4 ${changedUnit || changedDenom ? "border-[#fbbf24]/25 bg-[#fbbf24]/5" : "border-white/10 bg-white/[0.02]"}`}>
          <div className="font-mono text-[10px] uppercase tracking-widest text-white/35">Version B — after</div>
          <div className="mt-2 space-y-1 font-mono text-xs">
            <div className="flex justify-between gap-2"><span className="text-white/35">unit</span> <span className={changedUnit ? "text-[#fbbf24] font-semibold" : "text-white/80"}>{after.unit ?? "—"}</span></div>
            <div className="flex justify-between gap-2"><span className="text-white/35">denominator</span> <span className={changedDenom ? "text-[#fb923c] font-semibold" : "text-white/80"}>{after.denominator ?? "—"}</span></div>
          </div>
          <p className="mt-3 border-t border-white/[0.06] pt-3 font-sans text-xs leading-relaxed text-white/60">{after.operational_definition}</p>
        </div>
      </div>

      <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06] bg-white/[0.015] px-4">
        <Row label="Concept" value={finding.concept_id} />
        <Row label="Drift type" value={<span className="capitalize">{finding.drift_type?.replaceAll("_", " ") ?? "—"}</span>} />
        <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-mono text-[11px] uppercase tracking-wider text-white/35">Semantic impact</span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-1.5 w-28 overflow-hidden rounded-full bg-white/10">
              <motion.span initial={{ width: 0 }} animate={{ width: `${finding.semantic_impact * 100}%` }} transition={{ duration: 0.7, delay: 0.15 }} className="block h-full rounded-full bg-[#f59e0b]" />
            </span>
            <span className="font-mono text-xs text-white/70">{finding.semantic_impact.toFixed(2)}</span>
          </span>
        </div>
        <Row label="Comparability" value={<span className="capitalize">{finding.comparability_decision.replaceAll("_", " ")}</span>} />
        <Row label="Evidence" value={<span className="break-all text-[11px] text-white/50">{finding.evidence.join(" · ")}</span>} />
      </div>
    </div>
  );
}

export function ContradictionPayloadView({ finding }: { finding: ContradictionFinding }) {
  const va = Number(finding.claim_a.value);
  const vb = Number(finding.claim_b.value);
  const max = Math.max(va, vb, 1);
  const delta = finding.delta ?? Math.abs(va - vb);
  return (
    <div className="space-y-5">
      {/* Delta hero – evidence A vs B */}
      <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-widest text-white/35">Evidence A vs B — delta is the finding</span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[11px] text-white/40">Δ {typeof delta === "number" ? delta.toLocaleString("en-IN") : String(delta)}</span>
        </div>
        {[finding.claim_a, finding.claim_b].map((claim, i) => {
          const val = Number(claim.value);
          const isA = i === 0;
          return (
            <div key={i} className={`rounded-lg border p-3 ${isA ? "border-[#22d3ee]/20 bg-[#22d3ee]/5" : "border-[#f59e0b]/20 bg-[#f59e0b]/5"}`}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <HashText hash={String(claim.source_id)} />
                <span className="font-mono text-sm font-bold" style={{ color: isA ? "#22d3ee" : "#f59e0b" }}>
                  {val.toLocaleString("en-IN")} <span className="text-xs font-normal text-white/40">{String(claim.metric)}</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-black/30">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(val / max) * 100}%` }}
                  transition={{ duration: 0.65, delay: i * 0.1 }}
                  className="h-full rounded-full"
                  style={{ background: isA ? "#22d3ee" : "#f59e0b" }}
                />
              </div>
              <div className="mt-1.5 font-mono text-[11px] text-white/30">{String(claim.source_id)} · {String(claim.metric)}</div>
            </div>
          );
        })}
      </div>

      <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06] bg-white/[0.015] px-4">
        <Row label="Reconciliation" value={<span className="capitalize font-semibold">{finding.reconciliation_status.replaceAll("_", " ")}</span>} />
        {finding.delta !== null && finding.delta !== undefined && <Row label="Delta" value={<span>{String(finding.delta)}</span>} />}
        {Object.entries(finding.alignment_tests).map(([dim, state]) => (
          <Row key={dim} label={`Gate: ${dim}`} value={<span className="capitalize">{String(state).replaceAll("_", " ")}</span>} />
        ))}
      </div>

      <div className="rounded-xl border border-[#f59e0b]/15 bg-[#f59e0b]/5 px-4 py-3">
        <div className="font-mono text-[11px] uppercase tracking-widest text-[#f59e0b]/80">Possible explanations — human must verify</div>
        <ul className="mt-2 list-disc space-y-1 pl-4 font-sans text-xs leading-relaxed text-white/65">
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
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-white/35">Conformity</div>
          <div className={`mt-1 text-lg font-semibold capitalize ${finding.conformity === "nonconformity" ? "text-[#f87171]" : finding.conformity === "marginal" ? "text-[#fb923c]" : "text-[#fbbf24]"}`}>{finding.conformity}</div>
          <div className="font-mono text-[11px] text-white/30">{finding.conformity} vs Benford</div>
        </div>
        <div className="rounded-xl border border-[#f59e0b]/20 bg-[#f59e0b]/5 p-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-white/35">MAD — the delta</div>
          <div className="mt-1 font-mono text-lg font-bold text-[#f59e0b]">{finding.mad.toFixed(4)}</div>
          <div className="font-mono text-[11px] text-white/30">mean absolute deviation</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <div className="font-mono text-[10px] uppercase tracking-widest text-white/35">Values analysed</div>
          <div className="mt-1 font-mono text-lg font-semibold text-white/80">{finding.n_values.toLocaleString("en-IN")}</div>
          <div className="font-mono text-[11px] text-white/30">n</div>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-4">
        <div className="mb-3 flex flex-wrap items-center gap-3 font-mono text-[11px] uppercase tracking-wider text-white/35">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-3 rounded-full bg-white/25" /> expected</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-3 rounded-full bg-[#f59e0b]" /> observed</span>
          <span className="ml-auto text-white/25">digit 1–9 · excess is the signal</span>
        </div>
        <div className="space-y-2">
          {finding.digits.map((d, i) => (
            <div key={d.digit} className="flex items-center gap-2 font-mono text-xs">
              <span className="w-3 shrink-0 text-right text-white/45">{d.digit}</span>
              <div className="relative h-3.5 flex-1 overflow-hidden rounded bg-white/[0.04]">
                <motion.div initial={{ width: 0 }} animate={{ width: pct(d.expected_share) }} transition={{ duration: 0.45 }} className="absolute inset-y-0 left-0 rounded bg-white/20" />
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: pct(d.observed_share) }}
                  transition={{ duration: 0.55, delay: i * 0.04 }}
                  className={`absolute inset-y-0 left-0 rounded ${d.excess > 0.02 ? "bg-[#fb923c]" : d.excess < -0.05 ? "bg-[#38bdf8]" : "bg-[#f59e0b]/85"}`}
                />
              </div>
              <span className={`w-16 shrink-0 text-right tabular-nums ${d.excess > 0 ? "text-[#fb923c]" : "text-white/35"}`}>
                {d.excess >= 0 ? "+" : ""}{(d.excess * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {finding.caveats.length > 0 && (
        <ul className="list-disc space-y-1 pl-4 font-sans text-xs leading-relaxed text-white/45">
          {finding.caveats.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ConsensusPayloadView({ finding }: { finding: ConsensusFinding }) {
  const suspected = finding.verdict === "shared_origin_suspected";
  return (
    <div className="space-y-5">
      <div className={`rounded-xl border p-4 ${suspected ? "border-[#fbbf24]/25 bg-[#fbbf24]/5" : "border-emerald-400/20 bg-emerald-400/5"}`}>
        <div className={`font-mono text-sm font-semibold ${suspected ? "text-[#fbbf24]" : "text-emerald-400"}`}>
          {suspected
            ? `Only ${finding.distinct_origins} distinct origin${finding.distinct_origins === 1 ? "" : "s"} behind ${finding.apparent_sources} apparent source${finding.apparent_sources === 1 ? "" : "s"}`
            : "Claims trace to distinct origins — independent corroboration"}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/20">
          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(finding.diversity_ratio * 100, 4)}%` }} transition={{ duration: 0.8, delay: 0.12 }} className={`h-full rounded-full ${suspected ? "bg-[#fbbf24]" : "bg-emerald-500"}`} />
        </div>
        <div className="mt-1.5 font-mono text-xs text-white/40">Evidence diversity ratio {finding.diversity_ratio.toFixed(2)} — not raw source count</div>
      </div>
      <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06] bg-white/[0.015] px-4">
        <Row label="Metric" value={finding.metric} />
        {finding.origin_groups.map((group) => (
          <Row key={group.origin_artifact_id} label={<HashText hash={group.origin_artifact_id} />} value={<span className="break-all text-[11px] text-white/55">{group.members.length} claim(s): {group.members.join(", ")}</span>} />
        ))}
      </div>
    </div>
  );
}
