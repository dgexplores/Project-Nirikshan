"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatBytes } from "@/components/AnimatedNumber";
import { Breadcrumb } from "@/components/Breadcrumb";
import { HelpBanner } from "@/components/OnboardingStepper";
import { ArrowIcon, HashText, PageHeader } from "@/components/PageChrome";
import { ProgressSteps } from "@/components/ProgressSteps";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ErrorState } from "@/components/ui/ErrorState";
import { Spinner } from "@/components/ui/Spinner";
import { Panel } from "@/components/ui/Panel";
import { listArtifacts, listFindings, uploadArtifact, pollJob, type ArtifactSummary } from "@/lib/api";
import type { Job } from "@/lib/types";
import { cn, gradeToneClass } from "@/lib/utils";

const ACCEPT = ".csv,.tsv,.xlsx,.json,.jsonl,.parquet";

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path d="M12 16V4M12 4 7 9M12 4l5 5M5 20h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
  const [query, setQuery] = useState("");
  // How many open problems each file has, so this page links into the queue.
  const [problemCounts, setProblemCounts] = useState<Record<string, number>>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    listArtifacts()
      .then((res) => setItems(res.items))
      .catch((e: Error) => setError(e.message));

    listFindings({ status: "open", limit: 500 })
      .then((res) => {
        const counts: Record<string, number> = {};
        for (const f of res.items) {
          for (const id of f.artifact_ids ?? []) counts[id] = (counts[id] ?? 0) + 1;
        }
        setProblemCounts(counts);
      })
      // A missing count only dims this page's extra detail, the list still works.
      .catch(() => setProblemCounts({}));
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
        setUploadError(final.error || "This file could not be checked. Please try again.");
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

  const needle = query.trim().toLowerCase();
  const visible = (items ?? []).filter((a) =>
    `${a.title ?? ""} ${a.artifact_id}`.toLowerCase().includes(needle),
  );

  return (
    <div>
      <Breadcrumb items={[{ label: "Overview", href: "/" }, { label: "Your files" }]} />
      <PageHeader
        title="Your files"
        subtitle="Every file you upload gets a permanent, verified copy that can't be changed later. We check its quality automatically."
      />
      <HelpBanner
        title="Drop a file on the left, see it appear on the right"
        desc="After it's checked, we'll take you straight to its details: quality, where it came from, and its score."
        href="/findings"
        cta="See problems found"
      />

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* Upload panel */}
        <Panel className="h-fit lg:sticky lg:top-[84px]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Upload a file</h2>
            <span className="rounded-full bg-[var(--background)] px-2 py-0.5 text-xs text-[var(--foreground-muted)]">up to 200 MB</span>
          </div>

          <div
            role="button"
            tabIndex={0}
            aria-label="Choose a file to upload"
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
              dragOver ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--border-strong)] hover:border-[var(--brand)]/50 hover:bg-[var(--background)]",
            )}
          >
            <motion.span animate={dragOver ? { scale: 1.12 } : { scale: 1 }} className="flex size-9 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
              <UploadIcon className="size-4" />
            </motion.span>
            <span className="max-w-[22ch] truncate text-sm font-medium">{file ? file.name : "Drop a file here, or click to choose"}</span>
            <span className="text-xs text-[var(--foreground-faint)]">CSV, TSV, Excel, JSON, or Parquet</span>
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
                  <label className="block text-sm font-medium text-[var(--foreground-muted)]">
                    A short ID for this file *
                    <Input value={artifactId} onChange={(e) => setArtifactId(e.target.value)} className="mt-1.5 text-sm" required />
                  </label>
                  <label className="block text-sm font-medium text-[var(--foreground-muted)]">
                    Where is it from? *
                    <Input value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="mt-1.5 text-sm" placeholder="e.g. Ministry portal" required />
                  </label>
                  <label className="block text-sm font-medium text-[var(--foreground-muted)]">
                    Title (optional)
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5 text-sm" />
                  </label>
                  <label className="block text-sm font-medium text-[var(--foreground-muted)]">
                    Time period (optional)
                    <Input value={releaseDate} onChange={(e) => setReleaseDate(e.target.value)} className="mt-1.5 text-sm" placeholder="e.g. FY 2024-25" />
                  </label>
                  <Button
                    onClick={handleUpload}
                    disabled={!artifactId || !sourceId || (!!job && job.status === "running")}
                    className="w-full justify-center"
                  >
                    {!!job && job.status === "running" ? (
                      <>
                        <Spinner className="size-3.5" /> Checking your file…
                      </>
                    ) : (
                      "Upload and check"
                    )}
                  </Button>
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
                className="mt-3 rounded-xl border border-[var(--critical)]/25 bg-[var(--critical-soft)] px-3.5 py-2.5 text-sm text-[var(--critical)]"
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

        {/* File list */}
        <div className="min-w-0">
          {!items ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : (
            <div className="panel overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
                <h2 className="text-sm font-semibold text-[var(--foreground)]">
                  {visible.length === items.length
                    ? `${items.length} file${items.length === 1 ? "" : "s"} uploaded`
                    : `${visible.length} of ${items.length} files`}
                </h2>
                {items.length > 4 && (
                  <Input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search files by name…"
                    aria-label="Search your files by name"
                    className="h-9 w-full text-sm sm:w-64"
                  />
                )}
              </div>

              <div className="divide-y divide-[var(--border)]">
                <AnimatePresence initial={false}>
                  {visible.map((art, i) => (
                    <motion.div
                      key={art.artifact_id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.35) }}
                    >
                      <Link
                        href={`/datasets/${encodeURIComponent(art.artifact_id)}`}
                        className="group flex items-center gap-3 px-4 py-3.5 transition hover:bg-[var(--background)] focus-visible:outline-none"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[15px] font-medium leading-tight group-hover:text-[var(--brand)]">{art.title || art.artifact_id}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--foreground-muted)]">
                            <span>{art.row_count !== null ? `${art.row_count.toLocaleString("en-IN")} rows` : "Checking…"}</span>
                            <span className="text-[var(--foreground-faint)]">·</span>
                            <span>{formatBytes(art.byte_size)}</span>
                            {art.quality_flag_count > 0 && (
                              <>
                                <span className="text-[var(--foreground-faint)]">·</span>
                                <span className="text-[var(--medium)]">{art.quality_flag_count} thing{art.quality_flag_count === 1 ? "" : "s"} to check</span>
                              </>
                            )}
                            {(problemCounts[art.artifact_id] ?? 0) > 0 && (
                              <>
                                <span className="text-[var(--foreground-faint)]">·</span>
                                <span className="font-medium text-[var(--high)]">
                                  {problemCounts[art.artifact_id]} problem{problemCounts[art.artifact_id] === 1 ? "" : "s"} found
                                </span>
                              </>
                            )}
                            <span className="hidden sm:inline"><HashText hash={art.sha256} /></span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2.5">
                          {art.fitness_grade ? (
                            <span
                              className={cn("inline-flex size-9 items-center justify-center rounded-lg border text-sm font-bold", gradeToneClass(art.fitness_grade))}
                              title={`Quality grade ${art.fitness_grade}`}
                            >
                              {art.fitness_grade}
                            </span>
                          ) : (
                            <span className="inline-flex size-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white">
                              <Spinner className="size-4" />
                            </span>
                          )}
                          <ArrowIcon className="size-4 text-[var(--foreground-faint)] transition group-hover:text-[var(--brand)]" />
                        </div>
                      </Link>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {items.length === 0 && (
                <div className="px-4 py-12 text-center">
                  <div className="text-[15px] font-medium text-[var(--foreground)]">No files yet</div>
                  <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-[var(--foreground-muted)]">
                    Drop a file on the left to get started. We&apos;ll save a safe copy and check its quality automatically.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
