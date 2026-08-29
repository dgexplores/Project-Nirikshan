"use client";

import { useEffect, useState } from "react";

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

const DURATION_MS = 1100;

export function AnimatedNumber({
  value,
  decimals = 0,
  className,
}: {
  value: number;
  decimals?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const start = Date.now();
    let frame = 0;
    const tick = () => {
      const t = Math.min((Date.now() - start) / DURATION_MS, 1);
      setDisplay(value * easeOutCubic(t));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    // Backgrounded or unfocused tabs throttle requestAnimationFrame, in
    // some cases down to a rate that never reaches t=1. This guarantees
    // the real value lands even if the animation itself gets stalled.
    const settle = setTimeout(() => setDisplay(value), DURATION_MS + 150);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
    };
  }, [value]);

  return (
    <span className={className}>
      {display.toLocaleString("en-IN", {
        maximumFractionDigits: decimals,
        minimumFractionDigits: decimals,
      })}
    </span>
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}
