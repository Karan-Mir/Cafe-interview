import type { Session } from "./types";

const FAST_MS = 2000;

/** SPEC 6 -- computed on device, stored, NEVER shown to the player. */
export function recomputeQuality(s: Session): Session["quality"] {
  const design = s.cbc.responses.filter((r) => r.kind === "design");
  const lat = [...s.maxdiff.responses, ...s.cbc.responses].map((r) => r.latency_ms).sort((a, b) => a - b);
  const median = lat.length ? lat[Math.floor(lat.length / 2)] : 0;

  const fast_tasks = design.filter((r) => r.latency_ms < FAST_MS).length;

  // same card POSITION chosen in >= 8 of 10 design tasks
  const counts = new Map<number, number>();
  for (const r of design) counts.set(r.chosen, (counts.get(r.chosen) ?? 0) + 1);
  const straightlined = design.length >= 10 && Math.max(0, ...counts.values()) >= 8;

  return {
    median_latency_ms: median,
    fast_tasks,
    trap_failed: s.quality.trap_failed,
    straightlined,
    holdout_consistent: null,
    completed: s.cursor.module === "reveal" || s.cursor.module === "observe" || s.cursor.module === "done",
  };
}
