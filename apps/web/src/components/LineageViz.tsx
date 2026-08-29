"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { LineageGraph } from "@/lib/types";

// Plain-language stand-ins for the technical pipeline stage names.
const KIND_COLOR: Record<string, string> = {
  raw_artifact: "var(--brand)",
  parser: "var(--low)",
  profile: "#7c3aed",
  rule: "var(--medium)",
  finding: "var(--critical)",
};

const KIND_LABEL: Record<string, string> = {
  raw_artifact: "Your file",
  parser: "We read it",
  profile: "We checked it",
  rule: "We ran a check",
  finding: "What we found",
};

/**
 * Layered DAG layout by node kind depth. Pure SVG, no graph lib needed:
 * the lineage chain is always a simple layered pipeline.
 */
export function LineageViz({ graph }: { graph: LineageGraph }) {
  const layout = useMemo(() => {
    const order = ["raw_artifact", "parser", "profile", "rule", "finding"];
    const columns = order.map((kind) =>
      graph.nodes
        .filter((n) => n.kind === kind)
        .sort((a, b) => a.id.localeCompare(b.id)),
    );
    const colW = 240;
    const rowH = 64;
    const maxRows = Math.max(...columns.map((c) => c.length), 1);
    const width = Math.max(columns.length, 1) * colW;
    const height = Math.max(maxRows * rowH + 40, 140);
    const pos = new Map<string, { x: number; y: number }>();
    columns.forEach((col, ci) => {
      col.forEach((node, ri) => {
        pos.set(node.id, {
          x: ci * colW + colW / 2,
          y: (height - col.length * rowH) / 2 + ri * rowH + rowH / 2,
        });
      });
    });
    return { pos, width, height };
  }, [graph]);

  if (!graph.nodes.length) return null;

  return (
    <div>
      <p className="mb-3 text-sm leading-relaxed text-[var(--foreground-muted)]">
        This shows the path from your original file to this result, one step at a time, so you can see exactly how we got here.
      </p>
      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--background)] p-2">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          className="min-w-[720px]"
          style={{ width: "100%", height: layout.height }}
          role="img"
          aria-label="Diagram showing the steps from your file to this result"
        >
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 1 L 9 5 L 0 9 z" fill="rgba(28,31,38,0.3)" />
            </marker>
          </defs>
          {graph.edges.map((edge, i) => {
            const a = layout.pos.get(edge.from);
            const b = layout.pos.get(edge.to);
            if (!a || !b) return null;
            const mx = (a.x + b.x) / 2;
            return (
              <motion.path
                key={`${edge.from}-${edge.to}-${i}`}
                d={`M ${a.x + 70} ${a.y} C ${mx} ${a.y}, ${mx} ${b.y}, ${b.x - 74} ${b.y}`}
                fill="none"
                stroke="rgba(28,31,38,0.18)"
                strokeWidth={1.6}
                markerEnd="url(#arrow)"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.15 + i * 0.08 }}
              />
            );
          })}
          {graph.nodes.map((node, i) => {
            const p = layout.pos.get(node.id);
            if (!p) return null;
            const color = KIND_COLOR[node.kind] ?? "var(--foreground-muted)";
            return (
              <motion.g
                key={node.id}
                initial={{ opacity: 0, y: p.y + 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.45, delay: i * 0.06 }}
              >
                <g transform={`translate(${p.x}, ${p.y})`}>
                  <rect
                    x={-72}
                    y={-24}
                    width={144}
                    height={48}
                    rx={12}
                    fill="var(--surface)"
                    stroke={color}
                    strokeOpacity={0.33}
                  />
                  <circle cx={-58} cy={0} r={4} fill={color} />
                  <text x={-46} y={-4} fontSize={10} fill="rgba(28,31,38,0.45)" fontFamily="var(--font-sans), sans-serif" fontWeight={600}>
                    {(KIND_LABEL[node.kind] ?? node.kind).toUpperCase()}
                  </text>
                  <text x={-46} y={12} fontSize={11} fill="rgba(28,31,38,0.85)" fontFamily="var(--font-sans), sans-serif">
                    {node.label.length > 15 ? `${node.label.slice(0, 14)}…` : node.label}
                  </text>
                  <title>{`${node.label}\n${node.detail ?? ""}`}</title>
                </g>
              </motion.g>
            );
          })}
        </svg>
        <div className="mt-1 flex flex-wrap gap-3 px-1 pb-1 text-xs text-[var(--foreground-muted)]">
          {Object.entries(KIND_LABEL).map(([kind, label]) => (
            <span key={kind} className="inline-flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-full" style={{ background: KIND_COLOR[kind] }} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
