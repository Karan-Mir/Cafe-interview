import { createClient, type SupabaseClient, type Session as AuthSession } from "@supabase/supabase-js";

/**
 * The data store. Postgres in eu-west-1, reached with the PUBLISHABLE key.
 *
 * That key ships inside the app and a café owner holds the phone for nine
 * minutes, so it is deliberately worthless on its own: RLS grants `anon` no
 * read and no write (supabase/schema.sql). Everything below needs a signed-in
 * collector. The secret key is never in this repo and never in the bundle.
 */

const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isConfigured = Boolean(URL && KEY);

/** Null when unconfigured. Every caller must cope with that: SPEC 0.4 means the
 *  instrument runs start to finish with no backend at all. */
export const supabase: SupabaseClient | null = isConfigured
  ? createClient(URL!, KEY!, {
      auth: {
        persistSession: true,          // a collector signs in once, not per session
        autoRefreshToken: true,
        storageKey: "qz.auth",
      },
    })
  : null;

export async function currentUser(): Promise<AuthSession["user"] | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user ?? null;
}

export async function signIn(email: string, password: string) {
  if (!supabase) return { ok: false, detail: "اتصال به سرور پیکربندی نشده" };
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    const msg = /invalid login/i.test(error.message)
      ? "ایمیل یا رمز درست نیست"
      : /email not confirmed/i.test(error.message)
      ? "این حساب هنوز تأیید نشده"
      : error.message;
    return { ok: false, detail: msg };
  }
  return { ok: true, detail: "" };
}

export async function signOut() {
  await supabase?.auth.signOut();
}

/** Is the server reachable at all? Used by the sync panel, never by a player. */
export async function ping(): Promise<{ ok: boolean; detail: string }> {
  if (!supabase) return { ok: false, detail: "پیکربندی نشده" };
  try {
    const t0 = performance.now();
    const { error } = await supabase.from("sessions").select("session_id", { head: true, count: "exact" });
    const ms = Math.round(performance.now() - t0);
    if (error) {
      // a signed-out client is *expected* to be refused: that is RLS working
      if (/JWT|permission|denied/i.test(error.message)) {
        return { ok: true, detail: `سرور در دسترس است (${ms} میلی‌ثانیه) — ولی وارد نشده‌اید` };
      }
      return { ok: false, detail: error.message };
    }
    return { ok: true, detail: `سرور در دسترس است (${ms} میلی‌ثانیه)` };
  } catch (e) {
    return { ok: false, detail: "شبکه در دسترس نیست: " + (e as Error).message };
  }
}
