import cbcRaw from "../../design/cbc_design.json";
import mdRaw from "../../design/maxdiff_design.json";

/**
 * [STATS] SPEC 0.1 -- the design is DATA, never generated at runtime. These JSON
 * files are bundled at build time, so the app physically cannot shuffle or
 * "freshen" a choice set: runtime randomisation destroys the level balance and
 * near-orthogonality that make the model estimable.
 */
export const cbcDesign = cbcRaw as unknown as {
  meta: {
    attributes: { id: string; n_levels: number }[];
    alternatives: number; tasks_per_version: number; versions: number;
    parameters: number; design_version: string; content_sha256: string;
  };
  /** versions[v][task][alternative][attribute] -- four deep */
  versions: number[][][][];
  /** holdouts[task][alternative][attribute] */
  holdouts: number[][][];
  /** traps[task][alternative][attribute] */
  traps: number[][][];
};

export const maxdiffDesign = mdRaw as unknown as {
  meta: { n_items: number; set_size: number; sets_per_version: number; versions: number;
          design_version: string; content_sha256: string };
  versions: number[][][];
};

/** Stable, deterministic version assignment (SPEC 2.2, 4). FNV-1a over the uuid. */
export function hashToVersion(sessionId: string, nVersions: number): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < sessionId.length; i++) {
    h ^= sessionId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % nVersions;
}

/** Canonical JSON with sorted keys -- must match generate_designs.py exactly. */
function canonical(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  const o = v as Record<string, unknown>;
  return "{" + Object.keys(o).sort().map((k) => JSON.stringify(k) + ":" + canonical(o[k])).join(",") + "}";
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * [STATS] SPEC 4 -- the shipped JSON is the artefact of record. `cbc_version` is
 * an INDEX, so two tablets carrying different design files would record the same
 * index against different packages and the pooled data would be silently wrong.
 * The app refuses to run rather than let that happen.
 */
export async function verifyDesigns(): Promise<{ ok: boolean; detail: string }> {
  for (const [name, d] of [["cbc", cbcDesign], ["maxdiff", maxdiffDesign]] as const) {
    const { meta, ...body } = d as Record<string, unknown> & { meta: { content_sha256?: string } };
    const recorded = meta.content_sha256;
    if (!recorded) return { ok: false, detail: `${name}: no content_sha256 recorded` };
    const actual = await sha256Hex(canonical(body));
    if (actual !== recorded) {
      return { ok: false, detail: `${name}: recorded ${recorded.slice(0, 12)}… actual ${actual.slice(0, 12)}…` };
    }
  }
  return { ok: true, detail: cbcDesign.meta.design_version };
}

/** Index of the strictly dominated alternative in a trap task, or -1.
 *  [STATS] SPEC 2.4 -- compare PROFILES, never card positions: positions are
 *  shuffled per respondent, so an index test silently stops working. */
export function dominatedIndex(task: number[][]): number {
  for (let x = 0; x < task.length; x++) {
    for (let y = 0; y < task.length; y++) {
      if (x === y) continue;
      const a = task[x], b = task[y];
      const sameCore = a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
      if (sameCore && a[4] <= b[4] && a[5] <= b[5] && (a[4] < b[4] || a[5] < b[5])) return y;
    }
  }
  return -1;
}
