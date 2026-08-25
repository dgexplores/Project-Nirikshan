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
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="shrink-0 text-xs uppercase tracking-wider text-white/40">{label}</span>
      <span className="text-right text-sm text-white/85">{value}</span>
    </div>
  );
}

export function AnomalyPayloadView({ finding }: { finding: AnomalyFinding }) {
  const scale = Math.max(Math.abs(finding.observed), Math.abs(finding.expected), 1);
  const pct = (v: number) => `${Math.max((Math.abs(v) / scale) * 100, 2)}%`;
  const sliceText = Object.entries(finding.slice)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(", ");
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="panel p-3">
          <div className="text-[10px] uppercase tracking-wider text-white/40">Observed</div>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="mt-1 font-mono text-lg font-semibold text-[#fb923c]"
          >
            {finding.observed.toLocaleString("en-IN")}
          </motion.div>
        </div>
        <div className="panel p-3">
          <div className="text-[10px] uppercase tracking-wider text-white/40">Expected</div>
          <div className="mt-1 font-mono text-lg font-semibold text-white/80">
            {finding.expected.toLocaleString("en-IN")}
          </div>
        </div>
        <div className="panel p-3">
          <div className="text-[10px] uppercase tracking-wider text-white/40">Score ({finding.method})</div>
          <div className="mt-1 font-mono text-lg font-semibold text-[#f59e0b]">{finding.score}</div>
        </div>
      </div>

      <div className="space-y-2">
        <motion.div layout initial={{ width: 0 }} animate={{ width: pct(finding.expected) }}
          className="h-2.5 rounded-full bg-white/25" />
        <motion.div layout initial={{ width: 0 }} animate={{ width: pct(finding.observed) }}
          transition={{ delay: 0.15, type: "spring", stiffness: 60 }}
          className="h-2.5 rounded-full bg-gradient-to-r from-[#f59e0b] to-[#fb923c]" />
      </div>

      <div className="divide-y divide-white/[0.06]">
        <Row label="Slice" value={<span className="font-mono text-xs">{sliceText || "*"}</span>} />
        <Row label="Reproducible via" value={<code className="rounded bg-black/40 px-2 py-0.5 font-mono text-xs text-[#22d3ee]">{finding.evidence_query}</code>} />
        {finding.caveats.length > 0 && (
          <Row label="Caveats" value={finding.caveats.join("; ")} />
        )}
      </div>
    </div>
  );
}

export function DriftPayloadView({ finding }: { finding: DriftFinding }) {
  const before = finding.before_definition as Record<string, string | null>;
  const after = finding.after_definition as Record<string, string | null>;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]">
        <div className="panel p-4">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-white/40">Version A</div>
          <div className="space-y-1 text-sm">
            <div><span className="text-white/40">unit:</span> <span className="font-mono">{before.unit ?? "—"}</span></div>
            <div><span className="text-white/40">denominator:</span> <span className="font-mono">{before.denominator ?? "—"}</span></div>
            <p className="pt-1 text-xs leading-relaxed text-white/70">{before.operational_definition}</p>
          </div>
        </div>
        <div className="hidden items-center md:flex">
          <motion.span
            animate={{ x: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
            className="text-xl text-[#f59e0b]"
            aria-hidden
          >
            →
          </motion.span>
        </div>
        <div className="panel p-4">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-white/40">Version B</div>
          <div className="space-y-1 text-sm">
            <div><span className="text-white/40">unit:</span> <span className={`font-mono ${before.unit !== after.unit ? "text-[#fbbf24]" : ""}`}>{after.unit ?? "—"}</span></div>
            <div><span className="text-white/40">denominator:</span> <span className={`font-mono ${before.denominator !== after.denominator ? "text-[#fb923c]" : ""}`}>{after.denominator ?? "—"}</span></div>
            <p className="pt-1 text-xs leading-relaxed text-white/70">{after.operational_definition}</p>
          </div>
        </div>
      </div>
      <div className="divide-y divide-white/[0.06]">
        <Row label="Concept" value={<span className="font-mono text-xs">{finding.concept_id}</span>} />
        <Row label="Drift type" value={<span className="capitalize">{finding.drift_type?.replaceAll("_", " ")}</span>} />
        <Row
          label="Semantic impact"
          value={
            <span className="inline-flex items-center gap-2">
              <span className="inline-block h-1.5 w-28 overflow-hidden rounded-full bg-white/10">
                <motion.span
                  initial={{ width: 0 }}
                  animate={{ width: `${finding.semantic_impact * 100}%` }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  className="block h-full rounded-full bg-gradient-to-r from-[#38bdf8] to-[#fb923c]"
                />
              </span>
              <span className="font-mono text-xs">{finding.semantic_impact.toFixed(2)}</span>
            </span>
          }
        />
        <Row label="Comparability" value={<span className="capitalize">{finding.comparability_decision.replaceAll("_", " ")}</span>} />
        <Row label="Evidence" value={<span className="font-mono text-xs text-white/60">{finding.evidence.join(" · ")}</span>} />
      </div>
    </div>
  );
}

export function ContradictionPayloadView({ finding }: { finding: ContradictionFinding }) {
  const va = Number(finding.claim_a.value);
  const vb = Number(finding.claim_b.value);
  const max = Math.max(va, vb, 1);
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {[finding.claim_a, finding.claim_b].map((claim, i) => {
          const val = Number(claim.value);
          const color = i === 0 ? "#22d3ee" : "#f59e0b";
          return (
            <div key={i}>
              <div className="mb-1 flex items-baseline justify-between text-xs">
                <HashText hash={String(claim.source_id)} />
                <span className="font-mono" style={{ color }}>
                  {val.toLocaleString("en-IN")} <span className="text-white/40">{String(claim.metric)}</span>
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(val / max) * 100}%` }}
                  transition={{ duration: 0.7, delay: i * 0.12 }}
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${color}88, ${color})` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="divide-y divide-white/[0.06]">
        <Row label="Reconciliation" value={<span className="capitalize">{finding.reconciliation_status.replaceAll("_", " ")}</span>} />
        {finding.delta !== null && finding.delta !== undefined && (
          <Row label="Delta" value={<span className="font-mono">{finding.delta}</span>} />
        )}
        {Object.entries(finding.alignment_tests).map(([dim, state]) => (
          <Row key={dim} label={`Gate: ${dim}`} value={<span className="capitalize">{String(state).replaceAll("_", " ")}</span>} />
        ))}
      </div>
      <ul className="list-inside list-disc space-y-1 text-sm text-white/65">
        {finding.possible_explanations.map((ex, i) => <li key={i}>{ex}</li>)}
      </ul>
    </div>
  );
}

export function BenfordPayloadView({ finding }: { finding: BenfordFinding }) {
  const maxShare = Math.max(...finding.digits.map((d) => Math.max(d.observed_share, d.expected_share)));
  const pct = (v: number) => `${Math.max((v / maxShare) * 100, 2)}%`;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="panel p-3">
          <div className="text-[10px] uppercase tracking-wider text-white/40">Conformity</div>
          <div
            className={`mt-1 text-lg font-semibold capitalize ${
              finding.conformity === "nonconformity" ? "text-[#f87171]" : finding.conformity === "marginal" ? "text-[#fb923c]" : "text-[#fbbf24]"
            }`}
          >
            {finding.conformity}
          </div>
        </div>
        <div className="panel p-3">
          <div className="text-[10px] uppercase tracking-wider text-white/40">MAD</div>
          <div className="mt-1 font-mono text-lg font-semibold text-[#f59e0b]">{finding.mad.toFixed(4)}</div>
        </div>
        <div className="panel p-3">
          <div className="text-[10px] uppercase tracking-wider text-white/40">Values analysed</div>
          <div className="mt-1 font-mono text-lg font-semibold text-white/80">{finding.n_values.toLocaleString("en-IN")}</div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-4 text-[10px] uppercase tracking-wider text-white/40">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-3 rounded-full bg-gradient-to-r from-[#f59e0b] to-[#fb923c]" /> observed</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2 w-3 rounded-full bg-white/25" /> expected (Benford)</span>
        </div>
        <div className="space-y-2">
          {finding.digits.map((d, i) => (
            <div key={d.digit} className="flex items-center gap-2 text-xs">
              <span className="w-3 shrink-0 text-right font-mono text-white/50">{d.digit}</span>
              <div className="relative h-4 flex-1 overflow-hidden rounded bg-white/[0.04]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: pct(d.expected_share) }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-y-0 left-0 rounded bg-white/25"
                />
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: pct(d.observed_share) }}
                  transition={{ duration: 0.6, delay: i * 0.05 }}
                  className={`absolute inset-y-0 left-0 rounded ${
                    d.excess > 0.02
                      ? "bg-gradient-to-r from-[#fb923c] to-[#f87171]"
                      : d.excess < -0.05
                        ? "bg-gradient-to-r from-[#38bdf8]/70 to-[#38bdf8]"
                        : "bg-gradient-to-r from-[#f59e0b]/80 to-[#fbbf24]"
                  }`}
                />
              </div>
              <span className={`w-16 shrink-0 text-right font-mono tabular-nums ${d.excess > 0 ? "text-[#fb923c]" : "text-white/40"}`}>
                {d.excess >= 0 ? "+" : ""}
                {(d.excess * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      <ul className="list-inside list-disc space-y-1 text-xs leading-relaxed text-white/50">
        {finding.caveats.map((c, i) => <li key={i}>{c}</li>)}
      </ul>
    </div>
  );
}

export function ConsensusPayloadView({ finding }: { finding: ConsensusFinding }) {
  const suspected = finding.verdict === "shared_origin_suspected";
  return (
    <div className="space-y-4">
      <div className="panel p-4">
        <div className={`text-sm font-medium ${suspected ? "text-[#fbbf24]" : "text-emerald-400"}`}>
          {suspected
            ? `Only ${finding.distinct_origins} distinct origin${finding.distinct_origins === 1 ? "" : "s"} behind ${finding.apparent_sources} apparent source${finding.apparent_sources === 1 ? "" : "s"}`
            : "Claims trace to distinct origins - independent corroboration"}
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(finding.diversity_ratio * 100, 3)}%` }}
            transition={{ duration: 0.9, delay: 0.15 }}
            className={`h-full rounded-full ${suspected ? "bg-gradient-to-r from-[#fbbf24] to-[#fb923c]" : "bg-emerald-500"}`}
          />
        </div>
        <div className="mt-1 text-xs text-white/40">Evidence diversity ratio {finding.diversity_ratio.toFixed(2)} (not raw source count)</div>
      </div>
      <div className="divide-y divide-white/[0.06]">
        <Row label="Metric" value={<span className="font-mono text-xs">{finding.metric}</span>} />
        {finding.origin_groups.map((group) => (
          <Row
            key={group.origin_artifact_id}
            label={<HashText hash={group.origin_artifact_id} />}
            value={<span className="font-mono text-xs text-white/60">{group.members.length} claim(s): {group.members.join(", ")}</span>}
          />
        ))}
      </div>
    </div>
  );
}
