/** One session document. Mirrors SPEC 5 exactly; the analysis reads this shape. */
export type ModuleId =
  | "preflight" | "open" | "profile" | "maxdiff" | "coins"
  | "cbc" | "voice" | "reveal" | "observe" | "done";

export interface MaxDiffResponse {
  set: number;
  items: number[];
  best: number | null;
  worst: number | null;
  latency_ms: number;
}

export type CbcKind = "design" | "holdout" | "trap";

export interface CbcResponse {
  task: number;
  kind: CbcKind;
  /** where this task appeared in the shuffled sequence */
  position: number;
  /** profiles IN THE ORDER SHOWN -- `chosen` indexes this array */
  profiles: number[][];
  chosen: number;
  would_buy: boolean | null;
  latency_ms: number;
}

export interface Profile {
  years: number;
  branches: string;
  staff_ft: number;
  staff_pt: number;
  shifts: string;
  type: string;
  seats: number;
  pos: string;
  /** from the pre-flight screen, read off the menu -- never asked (SPEC 2.0) */
  price_ref_item: string;
  price_ref_toman: number;
}

export interface Observation {
  seats: number | null;
  occupancy: number | null;
  at_hour: string;
  price_espresso: number | null;
  menu_items: number | null;
  hours_open: number | null;
  menu_type: string;
  pos_seen: boolean | null;
  order_taking: string;
  location: string;
  signage: string;
  competitors_2min: number | null;
  wifi: boolean | null;
  outlets: boolean | null;
  queue: string;
  instagram: string;
  followers: number | null;
}

export interface Quality {
  median_latency_ms: number;
  fast_tasks: number;
  trap_failed: boolean;
  straightlined: boolean;
  holdout_consistent: null;
  completed: boolean;
}

export interface Session {
  schema: 1;
  session_id: string;
  design_version: string;
  price_mult: number[];
  started_at: string;
  finished_at: string | null;
  interviewer: string;
  device: string;
  played_by: string | null;
  consent: { analysis: boolean; named: boolean };
  profile: Partial<Profile>;
  maxdiff: { version: number; responses: MaxDiffResponse[] };
  coins: Record<string, number>;
  cbc: { version: number; responses: CbcResponse[] };
  open: { audio_ref: string | null; duration_s: number; text: string | null };
  close: { referrals: string[]; allow_pos_data: string | null; pilot_willing: boolean | null };
  observation: Partial<Observation>;
  quality: Quality;
  /** set only once the export file write has resolved (SPEC 0.5) */
  exported_at: string | null;
  /** set only once the upload actually resolved. Separate from exported_at:
   *  a file on the phone and a file in the repo are different guarantees. */
  synced_at: string | null;
  /** progress marker so a dead battery resumes on the same screen (SPEC 8) */
  cursor: { module: ModuleId; step: number };
}
