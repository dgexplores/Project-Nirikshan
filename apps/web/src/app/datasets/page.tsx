"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatBytes } from "@/components/AnimatedNumber";
import { Breadcrumb } from "@/components/Breadcrumb";
import { HelpBanner } from "@/components/OnboardingStepper";
import { HashText, PageHeader } from "@/components/PageChrome";
import { ProgressSteps } from "@/components/ProgressSteps";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ErrorState } from "@/components/ui/ErrorState";
import { Spinner } from "@/components/ui/Spinner";
import { Panel } from "@/components/ui/Panel";
import { listArtifacts, uploadArtifact, pollJob, type ArtifactSummary } from "@/lib/api";
import type { Job } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACCEPT = ".csv,.tsv,.xlsx,.json,.jsonl,.parquet";

export default function DatasetsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ArtifactSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [artifactId, setArtifactId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [title, setTitle] = useState("");
  const [releaseDate, setReleaseDate] = useState("");
  const [job, setJob] = useState<Job | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    listArtifacts()
      .then((res) => setItems(res.items))
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(load, [load]);

  function slugFrom(name: string) {
    return `art-${name
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40)}-${Date.now().toString(36).slice(-4)}`;
  }

  function pickFile(f: File) {
    setFile(f);
    setUploadError(null);
    setArtifactId(slugFrom(f.name));
    if (!sourceId) setSourceId(`SRC-${f.name.split(".")[0].slice(0, 20).toUpperCase().replace(/[^A-Z0-9]/g, "-") || "UPLOAD"}`);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  async function handleUpload() {
    if (!file || !artifactId || !sourceId) return;
    setUploadError(null);
    setJob(null);
    try {
      const accepted = await uploadArtifact(file, {
        artifactId,
        sourceId,
        title: title || undefined,
        releaseDate: releaseDate || undefined,
      });
      const final = await pollJob(accepted.job_id, setJob);
      if (final.status === "failed") {
        setUploadError(final.error || "ingest failed");
      } else {
        const newId = accepted.artifact_id;
        setFile(null);
        setTitle("");
        setReleaseDate("");
        router.push(`/datasets/${encodeURIComponent(newId)}`);
      }
    } catch (e) {
      setUploadError((e as Error).message);
    }
  }

  if (error && !items) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <Breadcrumb items={[{ label: "Dashboard", href: "/" }, { label: "Datasets" }]} />
      <PageHeader
        eyebrow={
          <>
            <span className="text-[#22d3ee]">EVIDENCE STORE</span>
            <span className="text-white/20">·</span>
            <span>{items ? `${items.length} frozen artifacts` : "loading…"}</span>
            <span className="hidden text-white/20 sm:inline">·</span>
            <span className="hidden sm:inline">SHA-256 · immutable · reproducible</span>
          </>
        }
        title="Datasets"
        subtitle="Every upload is hashed (SHA-256), frozen immutably, profiled and scored. Raw bytes are never modified — lineage is the source of truth."
      />
      <HelpBanner
        title="Forensic ingest — Drop on the left → frozen row appears on the right → click to inspect lineage"
        desc="After ingest you are auto-redirected to detail (profile, lineage, fitness). All evidence refs are hashes, not filenames."
        href="/findings"
        cta="Open Findings"
      />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Ingest rail – sticky but compact */}
        <Panel className="h-fit lg:sticky lg:top-[68px]">
          <div className="flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-widest text-white/45">Ingest artifact</h2>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] text-white/35">max 200 MB</span>
          </div>

          <div
            role="button"
            tabIndex={0}
            aria-label="Choose a file to ingest"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) pickFile(f);
            }}
            className={cn(
              "mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center transition sm:p-7",
              dragOver ? "border-[#f59e0b] bg-[#f59e0b]/10" : "border-white/14 hover:border-white/25 hover:bg-white/[0.02]",
            )}
          >
            <motion.span animate={dragOver ? { scale: 1.12 } : { scale: 1 }} className="text-2xl" aria-hidden>
              ⬆
            </motion.span>
            <span className="max-w-[22ch] truncate text-sm font-medium">{file ? file.name : "Drop a dataset or click"}</span>
            <span className="text-xs text-white/35">CSV · TSV · XLSX · JSON · JSONL · Parquet</span>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) pickFile(f);
              }}
            />
          </div>

          <AnimatePresence>
            {file && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 space-y-3">
                  <label className="block text-xs font-medium uppercase tracking-wider text-white/40">
                    Artifact ID *
                    <Input value={artifactId} onChange={(e) => setArtifactId(e.target.value)} className="mt-1 font-mono text-xs" required />
                  </label>
                  <label className="block text-xs font-medium uppercase tracking-wider text-white/40">
                    Source ID *
                    <Input value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="mt-1 font-mono text-xs" placeholder="SRC-…" required />
                  </label>
                  <label className="block text-xs font-medium uppercase tracking-wider text-white/40">
                    Title
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 text-sm" />
                  </label>
                  <label className="block text-xs font-medium uppercase tracking-wider text-white/40">
                    Release / period label
                    <Input value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} className="mt-1 text-sm" placeholder="FY 2024-25" />
                  </label>
                  <Button
                    onClick={handleUpload}
                    disabled={!artifactId || !sourceId || (!!job && job.status === "running")}
                    className="w-full justify-center"
                  >
                    {!!job && job.status === "running" ? (
                      <>
                        <Spinner className="size-3.5" /> Analyzing…
                      </>
                    ) : (
                      "Ingest & analyze"
                    )}
                  </Button>
                  <p className="text-center text-[11px] leading-relaxed text-white/30">Frozen on write · hash + parser version → reproducible profile.</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {uploadError && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-3 rounded-lg border border-[#f87171]/30 bg-[#f87171]/10 px-3 py-2 text-xs text-[#f87171]"
              >
                {uploadError}
              </motion.p>
            )}
            {job && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4">
                <ProgressSteps job={job} />
              </motion.div>
            )}
          </AnimatePresence>
        </Panel>

        {/* Dense ledger – table-like rows */}
        <div className="min-w-0">
          {!items ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : (
            <div className="panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-white/[0.015] px-3 py-2.5 sm:px-4">
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-white/45">
                  Frozen ledger · {items.length} artifacts
                </h2>
                <span className="hidden font-mono text-[11px] text-white/30 sm:inline">scan: hash · fitness · lineage →</span>
                <span className="font-mono text-[11px] text-white/30 sm:hidden">hash · fitness →</span>
              </div>

              {/* Column header – hidden at 390, visible sm */}
              <div className="hidden grid-cols-[1fr_92px_84px_52px_36px] items-center gap-2 border-b border-white/[0.06] bg-white/[0.015] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white/30 sm:grid sm:px-4">
                <span>Dataset / evidence ref</span>
                <span className="text-right">Rows × cols</span>
                <span className="text-right">Size</span>
                <span className="text-center">Flags</span>
                <span className="text-center">Fit</span>
              </div>

              <div className="divide-y divide-white/[0.05]">
                <AnimatePresence initial={false}>
                  {items.map((art, i) => (
                    <motion.div
                      key={art.artifact_id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.35) }}
                    >
                      <Link
                        href={`/datasets/${encodeURIComponent(art.artifact_id)}`}
                        className="group flex items-center gap-3 px-3 py-3 transition hover:bg-white/[0.022] focus-visible:outline-none sm:grid sm:grid-cols-[1fr_92px_84px_52px_36px] sm:gap-2 sm:px-4"
                      >
                        {/* Primary: identity + evidence refs */}
                        <div className="min-w-0 flex-1 sm:min-w-0">
                          <div className="truncate text-sm font-medium leading-tight group-hover:text-[#f59e0b]">{art.title || art.artifact_id}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex max-w-[14ch] truncate rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[11px] text-white/45 sm:max-w-none">
                              {art.artifact_id}
                            </span>
                            <span className="hidden sm:inline-flex">
                              <HashText hash={art.sha256} />
                            </span>
                            <span className="inline-flex font-mono text-[11px] text-white/20 sm:hidden">· {art.sha256.slice(0, 8)}…</span>
                            {art.release_date && (
                              <span className="hidden rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[11px] text-white/40 sm:inline-flex">
                                {art.release_date}
                              </span>
                            )}
                          </div>
                          {/* Mobile secondary line – collapsed metadata */}
                          <div className="mt-1 flex items-center gap-2 font-mono text-[11px] text-white/30 sm:hidden">
                            <span>{art.row_count !== null ? `${art.row_count.toLocaleString("en-IN")}×${art.column_count ?? "—"}` : "—"}</span>
                            <span className="text-white/15">·</span>
                            <span>{formatBytes(art.byte_size)}</span>
                            {art.quality_flag_count > 0 && <span className="text-[#fbbf24]">· {art.quality_flag_count} flags</span>}
                          </div>
                        </div>

                        {/* Desktop columns – hidden at 390, preserved in detail */}
                        <span className="hidden text-right font-mono text-xs tabular-nums text-white/50 sm:block">
                          {art.row_count !== null ? `${art.row_count.toLocaleString("en-IN")}×${art.column_count ?? "—"}` : "—"}
                        </span>
                        <span className="hidden text-right font-mono text-xs text-white/35 sm:block">{formatBytes(art.byte_size)}</span>
                        <span className="hidden justify-center sm:flex">
                          {art.quality_flag_count > 0 ? (
                            <span className="rounded-full border border-[#fbbf24]/25 bg-[#fbbf24]/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-[#fbbf24]">{art.quality_flag_count}</span>
                          ) : (
                            <span className="font-mono text-[11px] text-white/20">—</span>
                          )}
                        </span>

                        {/* Fitness – always visible (primary scan + action) */}
                        <span className="flex shrink-0 items-center gap-2">
                          {art.fitness_grade ? (
                            <span
                              className={`inline-flex size-8 items-center justify-center rounded-lg border font-mono text-sm font-bold ${
                                ["A", "B"].includes(art.fitness_grade)
                                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400"
                                  : art.fitness_grade === "C"
                                    ? "border-[#fbbf24]/30 bg-[#fbbf24]/10 text-[#fbbf24]"
                                    : "border-[#fb923c]/30 bg-[#fb923c]/10 text-[#fb923c]"
                              }`}
                              title={`Fitness ${art.fitness_grade} · ${art.fitness_score ?? ""}`}
                            >
                              {art.fitness_grade}
                            </span>
                          ) : (
                            <span className="inline-flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]">
                              <Spinner className="size-4" />
                            </span>
                          )}
                          <span className="inline-flex size-6 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/25 transition group-hover:border-[#f59e0b]/30 group-hover:bg-[#f59e0b]/10 group-hover:text-[#f59e0b]" aria-hidden>
                            →
                          </span>
                        </span>
                      </Link>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {items.length === 0 && (
                <div className="px-4 py-10 text-center">
                  <div className="text-sm font-medium text-white/60">No artifacts yet — ingest first evidence</div>
                  <p className="mx-auto mt-1.5 max-w-sm text-xs leading-relaxed text-white/35">
                    Drop a dataset on the left. It will be hashed (SHA-256), frozen immutably and profiled — then findings can be generated and reviewed in the queue.
                  </p>
                </div>
              )}
            </div>
          )}
          {items && items.length > 0 && <p className="mt-2 text-center text-[11px] text-white/25">Tip: hash is the evidence locator — click any row to see lineage &amp; profile.</p>}
        </div>
      </div>
    </div>
  );
}
