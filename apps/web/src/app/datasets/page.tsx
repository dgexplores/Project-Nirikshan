"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatBytes } from "@/components/AnimatedNumber";
import { PageHeader, HashText } from "@/components/PageChrome";
import { ProgressSteps } from "@/components/ProgressSteps";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ErrorState } from "@/components/ui/ErrorState";
import { Spinner } from "@/components/ui/Spinner";
import { Panel } from "@/components/ui/Panel";
import {
  listArtifacts,
  uploadArtifact,
  pollJob,
  type ArtifactSummary,
} from "@/lib/api";
import type { Job } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACCEPT = ".csv,.tsv,.xlsx,.json,.jsonl,.parquet";

export default function DatasetsPage() {
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
      const accepted = await uploadArtifact(file, { artifactId, sourceId, title: title || undefined, releaseDate: releaseDate || undefined });
      const final = await pollJob(accepted.job_id, setJob);
      if (final.status === "failed") {
        setUploadError(final.error || "ingest failed");
      } else {
        setFile(null);
        setTitle("");
        setReleaseDate("");
        load();
      }
    } catch (e) {
      setUploadError((e as Error).message);
    }
  }

  if (error && !items) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Datasets"
        subtitle="Every upload is hashed (SHA-256), frozen immutably, profiled and scored. Raw bytes are never modified."
      />

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Panel className="h-fit lg:sticky lg:top-24">
          <div
            role="button"
            tabIndex={0}
            aria-label="Choose a file to ingest"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files?.[0];
              if (f) pickFile(f);
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-8 text-center transition",
              dragOver
                ? "border-[#f59e0b] bg-[#f59e0b]/10"
                : "border-white/15 hover:border-white/30 hover:bg-white/[0.02]",
            )}
          >
            <motion.span
              animate={dragOver ? { scale: 1.15 } : { scale: 1 }}
              className="text-3xl"
              aria-hidden
            >
              ⬆
            </motion.span>
            <span className="text-sm font-medium">{file ? file.name : "Drop a dataset or click"}</span>
            <span className="text-xs text-white/40">CSV · TSV · XLSX · JSON · JSONL · Parquet — max 200 MB</span>
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
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
                  </label>
                  <label className="block text-xs font-medium uppercase tracking-wider text-white/40">
                    Release / period label
                    <Input value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} className="mt-1" placeholder="FY 2024-25" />
                  </label>
                  <Button onClick={handleUpload} disabled={!artifactId || !sourceId || (!!job && job.status === "running")} className="w-full justify-center">
                    {(!!job && job.status === "running") ? (<><Spinner className="size-3.5" /> Analyzing…</>) : "Ingest & analyze"}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {uploadError && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3 rounded-lg border border-[#f87171]/30 bg-[#f87171]/10 px-3 py-2 text-xs text-[#f87171]">
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

        <div className="space-y-3">
          {!items && (
            <div className="flex justify-center py-16"><Spinner /></div>
          )}
          <AnimatePresence initial={false}>
            {items?.map((art, i) => (
              <motion.div
                key={art.artifact_id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <Link href={`/datasets/${encodeURIComponent(art.artifact_id)}`} className="panel group block p-4 transition hover:border-[#f59e0b]/40">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-medium group-hover:text-[#f59e0b]">{art.title || art.artifact_id}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-white/40">
                        <span className="font-mono">{art.artifact_id}</span>
                        <HashText hash={art.sha256} />
                        <span>{formatBytes(art.byte_size)}</span>
                        {art.release_date && <span className="rounded bg-white/[0.05] px-1.5 py-px font-mono">{art.release_date}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {art.row_count !== null && <span className="text-white/50">{art.row_count.toLocaleString("en-IN")} × {art.column_count}</span>}
                      {art.quality_flag_count > 0 && (
                        <span className="rounded-full border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-2 py-0.5 text-[#fbbf24]">{art.quality_flag_count} flags</span>
                      )}
                      {art.fitness_grade ? (
                        <span
                          className={`inline-flex size-8 items-center justify-center rounded-lg border font-mono text-sm font-bold ${
                            ["A", "B"].includes(art.fitness_grade)
                              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400"
                              : art.fitness_grade === "C"
                                ? "border-[#fbbf24]/30 bg-[#fbbf24]/10 text-[#fbbf24]"
                                : "border-[#fb923c]/30 bg-[#fb923c]/10 text-[#fb923c]"
                          }`}
                          title={`Fitness score ${art.fitness_score}`}
                        >
                          {art.fitness_grade}
                        </span>
                      ) : (
                        <Spinner className="size-4" />
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </AnimatePresence>
          {items && !items.length && (
            <p className="panel p-8 text-center text-sm text-white/35">No artifacts yet. Drop your first dataset on the left.</p>
          )}
        </div>
      </div>
    </div>
  );
}
