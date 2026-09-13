import { db } from "./db";
import { supabase, isConfigured } from "./supabase";
import { deviceId, pending } from "./outbox";

/**
 * Upload. Online is the source of truth; the phone keeps an outbox.
 *
 * [STATS] SPEC 0.4 -- none of this is on the critical path. The session is in
 * IndexedDB before any upload is attempted, the owner's nine minutes never wait
 * on a network call, and a total backend outage costs a delay, not a café. If
 * you ever find yourself making a screen await a sync, the instrument is broken.
 *
 * The outbox exists for one reason: a café with no signal. Writing only to the
 * network loses that interview the moment the owner hands the phone back, and
 * that café cannot be asked twice. Once the server CONFIRMS the row -- by
 * reading it back, not by trusting the insert -- the local copy is purged.
 */

export interface SyncResult { uploaded: number; failed: number; errors: string[]; }

/** Push everything outstanding. Safe to call as often as you like. */
export async function syncNow(): Promise<SyncResult> {
  const out: SyncResult = { uploaded: 0, failed: 0, errors: [] };
  if (!isConfigured || !supabase || !navigator.onLine) return out;

  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) {
    out.errors.push("وارد نشده‌اید — از پنل مدیریت وارد شوید");
    return out;
  }

  for (const s of await pending()) {
    try {
      // Both screens now write the same key, so these agree. The fallback
      // remains only for sessions recorded before this became one field.
      const device = deviceId() || s.device || "unknown";

      // voice first: a row without its recording is worse than neither,
      // because the row is what marks the session done.
      if (s.open.audio_ref) {
        const rec = await db.audio.get(s.open.audio_ref);
        if (rec) {
          const { error: upErr } = await supabase.storage
            .from("voice")
            .upload(`${s.session_id}.webm`, rec.blob, { contentType: rec.blob.type || "audio/webm", upsert: true });
          if (upErr && !/exists/i.test(upErr.message)) throw new Error("voice: " + upErr.message);
        }
      }

      const { error } = await supabase.from("sessions").upsert({
        session_id: s.session_id,
        device,
        interviewer: s.interviewer,
        started_at: s.started_at,
        finished_at: s.finished_at,
        design_version: s.design_version,
        price_mult: s.price_mult,
        doc: s,
      }, { onConflict: "session_id" });
      if (error) throw new Error(error.message);

      // Confirm by reading it back. An insert that returned without error is
      // not the same as a row that exists, and the local copy is about to be
      // deleted on the strength of this.
      const { data: check, error: checkErr } = await supabase
        .from("sessions").select("session_id").eq("session_id", s.session_id).maybeSingle();
      if (checkErr) throw new Error("confirm: " + checkErr.message);
      if (!check) throw new Error("confirm: server did not return the row");

      // Confirmed durable. Stop storing it locally.
      await db.sessions.delete(s.session_id);
      if (s.open.audio_ref) await db.audio.delete(s.open.audio_ref).catch(() => {});
      out.uploaded++;
    } catch (e) {
      out.failed++;
      out.errors.push(`${s.session_id.slice(0, 8)}: ${(e as Error).message}`);
    }
  }
  return out;
}

/** Fire-and-forget. After a session closes, when the network returns, on open.
 *  Nothing the player can see ever awaits this. */
export function syncInBackground() {
  void syncNow().catch(() => {});
}
