"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { LineageGraph } from "@/lib/types";

const KIND_COLOR: Record<string, string> = {
  raw_artifact: "#22d3ee",
  parser: "#818cf8",
  profile: "#a78bfa",
  rule: "#f59e0b",
  finding: "#f87171",
};

const KIND_LABEL: Record<string, string> = {
  raw_artifact: "Raw artifact",
  parser: "Parser",
  profile: "Profile",
  rule: "Rule",
  finding: "Finding",
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
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        className="min-w-[720px]"
        style={{ width: "100%", height: layout.height }}
        role="img"
        aria-label="Evidence lineage graph"
      >
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M 0 1 L 9 5 L 0 9 z" fill="rgba(255,255,255,0.35)" />
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
              stroke="rgba(255,255,255,0.22)"
              strokeWidth={1.4}
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
          const color = KIND_COLOR[node.kind] ?? "#94a3b8";
          return (
            <motion.g
              key={node.id}
              initial={{ opacity: 0, y: p.y + 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              // SVG <g> transform handled via attr below
            >
              <g transform={`translate(${p.x}, ${p.y})`}>
                <rect
                  x={-72}
                  y={-24}
                  width={144}
                  height={48}
                  rx={10}
                  fill="rgba(255,255,255,0.04)"
                  stroke={`${color}55`}
                />
                <circle cx={-58} cy={0} r={4} fill={color} />
                <text x={-46} y={-4} fontSize={10} fill="rgba(255,255,255,0.45)" fontFamily="var(--font-mono), monospace">
                  {(KIND_LABEL[node.kind] ?? node.kind).toUpperCase()}
                </text>
                <text x={-46} y={11} fontSize={11} fill="rgba(255,255,255,0.85)" fontFamily="var(--font-mono), monospace">
                  {node.label.length > 15 ? `${node.label.slice(0, 14)}…` : node.label}
                </text>
                <title>{`${node.label}\n${node.detail ?? ""}`}</title>
              </g>
            </motion.g>
          );
        })}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-white/40">
        {Object.entries(KIND_LABEL).map(([kind, label]) => (
          <span key={kind} className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full" style={{ background: KIND_COLOR[kind] }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
