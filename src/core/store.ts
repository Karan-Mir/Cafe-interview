import { create } from "zustand";
import type { Session, ModuleId, CbcResponse, MaxDiffResponse } from "./types";
import { cbcDesign, maxdiffDesign, hashToVersion, dominatedIndex } from "./designs";
import { PRICE_MULT } from "../content/items";
import { putSession } from "./db";
import { recomputeQuality } from "./quality";

/** Deterministic PRNG, seeded from the session id.
 *  [STATS] The task SEQUENCE and the left-to-right card order are presentation,
 *  and may vary per respondent -- but they must be REPRODUCIBLE, so a dead
 *  battery resumes to the identical screen rather than a freshly shuffled one. */
function mulberry32(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFrom(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h;
}
function shuffled<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface CbcTask {
  task: number;
  kind: "design" | "holdout" | "trap";
  /** profiles in the order they will be SHOWN */
  profiles: number[][];
  /** index within `profiles` of the dominated alternative, or -1 */
  dominated: number;
}

/** Build this respondent's fixed task list. SPEC 2.4: the ASSIGNMENT of design /
 *  holdout / trap is fixed in the design file; only the order varies, and the
 *  left-to-right card order within each task is shuffled to kill position bias. */
export function buildCbcTasks(sessionId: string): CbcTask[] {
  const v = hashToVersion(sessionId, cbcDesign.meta.versions);
  const rnd = mulberry32(seedFrom(sessionId));
  const raw: CbcTask[] = [];
  cbcDesign.versions[v].forEach((t, i) => raw.push({ task: i, kind: "design", profiles: t, dominated: -1 }));
  cbcDesign.holdouts.forEach((t, i) => raw.push({ task: 100 + i, kind: "holdout", profiles: t, dominated: -1 }));
  cbcDesign.traps.forEach((t, i) => raw.push({ task: 200 + i, kind: "trap", profiles: t, dominated: -1 }));
  return shuffled(raw, rnd).map((t) => {
    const order = shuffled(t.profiles.map((_, i) => i), rnd);
    const profiles = order.map((i) => t.profiles[i]);
    return { ...t, profiles, dominated: t.kind === "trap" ? dominatedIndex(profiles) : -1 };
  });
}

export function buildMaxdiffSets(sessionId: string): number[][] {
  const v = hashToVersion(sessionId, maxdiffDesign.meta.versions);
  return maxdiffDesign.versions[v];
}

function blank(sessionId: string, interviewer: string, device: string): Session {
  return {
    schema: 1,
    session_id: sessionId,
    design_version: cbcDesign.meta.design_version,
    price_mult: PRICE_MULT,
    started_at: new Date().toISOString(),
    finished_at: null,
    interviewer, device,
    played_by: null,
    consent: { analysis: true, named: false },
    profile: {},
    maxdiff: { version: hashToVersion(sessionId, maxdiffDesign.meta.versions), responses: [] },
    coins: {},
    cbc: { version: hashToVersion(sessionId, cbcDesign.meta.versions), responses: [] },
    open: { audio_ref: null, duration_s: 0, text: null },
    close: { referrals: [], allow_pos_data: null, pilot_willing: null },
    observation: {},
    quality: {
      median_latency_ms: 0, fast_tasks: 0, trap_failed: false,
      straightlined: false, holdout_consistent: null, completed: false,
    },
    exported_at: null,
    synced_at: null,
    cursor: { module: "open", step: 0 },
  };
}

interface State {
  session: Session | null;
  paused: boolean;
  begin: (interviewer: string, device: string, refItem: string, refToman: number) => Promise<void>;
  resume: (s: Session) => void;
  patch: (fn: (s: Session) => void) => Promise<void>;
  goto: (module: ModuleId, step?: number) => Promise<void>;
  setPaused: (v: boolean) => void;
  recordMaxdiff: (r: MaxDiffResponse) => Promise<void>;
  recordCbc: (r: CbcResponse, dominated: number) => Promise<void>;
}

export const useSession = create<State>((set, get) => ({
  session: null,
  paused: false,

  begin: async (interviewer, device, refItem, refToman) => {
    const id = crypto.randomUUID();
    const s = blank(id, interviewer, device);
    s.profile.price_ref_item = refItem;
    s.profile.price_ref_toman = refToman;
    await putSession(s);
    set({ session: s });
  },

  resume: (s) => set({ session: s }),

  patch: async (fn) => {
    const cur = get().session;
    if (!cur) return;
    const next: Session = structuredClone(cur);
    fn(next);
    next.quality = recomputeQuality(next);
    await putSession(next);          // SPEC 8 -- persisted immediately, every answer
    set({ session: next });
  },

  goto: async (module, step = 0) => {
    await get().patch((s) => {
      s.cursor = { module, step };
      if (module === "done") s.finished_at = new Date().toISOString();
    });
    // SPEC 0.4 -- fired AFTER the session is closed and already in IndexedDB.
    // Nothing awaits it; the owner never sees a spinner or an error.
    if (module === "done") {
      void import("./sync").then(({ syncInBackground }) => syncInBackground());
    }
  },

  setPaused: (v) => set({ paused: v }),

  recordMaxdiff: async (r) => {
    await get().patch((s) => {
      const i = s.maxdiff.responses.findIndex((x) => x.set === r.set);
      if (i >= 0) s.maxdiff.responses[i] = r; else s.maxdiff.responses.push(r);
    });
  },

  recordCbc: async (r, dominated) => {
    await get().patch((s) => {
      const i = s.cbc.responses.findIndex((x) => x.task === r.task);
      if (i >= 0) s.cbc.responses[i] = r; else s.cbc.responses.push(r);
      // [STATS] SPEC 2.4 -- by profile, never by index
      if (r.kind === "trap" && dominated >= 0 && r.chosen === dominated) s.quality.trap_failed = true;
    });
  },
}));
