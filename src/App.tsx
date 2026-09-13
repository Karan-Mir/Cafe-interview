import { lazy, Suspense, useEffect, useState } from "react";
import { useSession } from "./core/store";
import { verifyDesigns } from "./core/designs";
import { allSessions, unfinished } from "./core/db";
import { exportSession, exportAll } from "./core/export";
import { pendingCount } from "./core/outbox";
import { COPY } from "./content/items";
import { fa } from "./core/fa";
import type { Session } from "./core/types";

import Preflight from "./modules/Preflight";
import RotateHint from "./ui/RotateHint";
import DialogOverlay from "./ui/DialogOverlay";

const M00Open = lazy(() => import("./modules/M00Open"));
const M01Profile = lazy(() => import("./modules/M01Profile"));
const M02MaxDiff = lazy(() => import("./modules/M02MaxDiff"));
const M03Coins = lazy(() => import("./modules/M03Coins"));
const M04CBC = lazy(() => import("./modules/M04CBC"));
const M05Voice = lazy(() => import("./modules/M05Voice"));
const M06Reveal = lazy(() => import("./modules/M06Reveal"));
const M07Observe = lazy(() => import("./modules/M07Observe"));
const AdminPanel = lazy(() => import("./modules/AdminPanel"));

const loading = <div className="overlay" role="status" aria-live="polite"><p>در حال آماده‌سازی صفحه…</p></div>;

type Gate = { ok: boolean; detail: string } | null;

export default function App() {
  const session = useSession((s) => s.session);
  const resume = useSession((s) => s.resume);
  const paused = useSession((s) => s.paused);
  const setPaused = useSession((s) => s.setPaused);

  const [gate, setGate] = useState<Gate>(null);
  const [pin, setPin] = useState("");
  const [askPin, setAskPin] = useState(false);
  const [pinTry, setPinTry] = useState("");
  const [observing, setObserving] = useState(false);
  const [resumable, setResumable] = useState<Session | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pending, setPending] = useState(0);
  const [pinIntent, setPinIntent] = useState<"observe" | "sync">("observe");
  const [all, setAll] = useState<Session[]>([]);

  // [STATS] SPEC 4 -- refuse to run on a design file that does not match its hash.
  useEffect(() => { verifyDesigns().then(setGate); }, []);

  // The backend, such as it is. Fire-and-forget: nothing on screen ever awaits
  // it, and a dead network costs a delay, never a session (SPEC 0.4).
  useEffect(() => {
    const sync = () => { void import("./core/sync").then(({ syncInBackground }) => syncInBackground()); };
    sync();
    const back = () => sync();
    window.addEventListener("online", back);
    return () => window.removeEventListener("online", back);
  }, []);

  useEffect(() => {
    const tick = () => pendingCount().then(setPending);
    tick();
    const id = window.setInterval(tick, 5000);
    return () => window.clearInterval(id);
  }, []);

  // SPEC 8 -- a crash or a dead battery must resume at the same screen.
  useEffect(() => { unfinished().then((s) => s && setResumable(s)); }, []);
  useEffect(() => { if (showAdmin) allSessions().then(setAll); }, [showAdmin]);
  // Each new question starts at its instructions, including on narrow screens.
  useEffect(() => { window.scrollTo({ top: 0, behavior: "auto" }); }, [session?.cursor.module, session?.cursor.step]);

  if (!gate) return <div className="overlay" role="status" aria-live="polite"><p>در حال بررسی فایل‌های طرح…</p></div>;

  if (!gate.ok) {
    return (
      <DialogOverlay alert title="فایل طرح با امضای خودش نمی‌خواند">
        <p className="small muted" style={{ maxWidth: "28rem" }}>
          این تبلت نسخهٔ متفاوتی از طرح را حمل می‌کند. اگر با این نسخه مصاحبه بگیرید،
          داده‌ها با بقیهٔ تبلت‌ها قابل ادغام نخواهد بود و هیچ هشداری هم در تحلیل
          ظاهر نمی‌شود. تا جایگزینی فایل، مصاحبه نگیرید.
        </p>
        <code className="small">{gate.detail}</code>
      </DialogOverlay>
    );
  }

  if (!session) {
    if (syncing) return <Suspense fallback={loading}><AdminPanel onDone={() => setSyncing(false)} /></Suspense>;
    return (
      <>
        {resumable && (
          <DialogOverlay title="یک جلسهٔ ناتمام هست">
            <p className="small muted">
              شروع {new Date(resumable.started_at).toLocaleString("fa-IR")}
            </p>
            <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap", justifyContent: "center" }}>
              <button className="btn primary" onClick={() => { resume(resumable); setResumable(null); }}>
                ادامه بده
              </button>
              <button className="btn ghost" onClick={() => setResumable(null)}>جلسهٔ تازه</button>
            </div>
          </DialogOverlay>
        )}
        <Preflight onReady={setPin} tools={
          /* The admin panel is gated by the Supabase login, which is a stronger
             gate than the session PIN -- so before a session exists it opens
             directly. Mid-session it stays behind the PIN, because then a café
             owner is holding the phone. */
          <nav className="preflight-tools" aria-label="ابزارهای مصاحبه‌گر">
            <button className="btn quiet"
                    onClick={() => setSyncing(true)}>
              پنل مدیریت{pending > 0 ? ` (${new Intl.NumberFormat("fa-IR").format(pending)})` : ""}
            </button>
            <button className="btn quiet"
                    onClick={() => setShowAdmin(true)}>بایگانی</button>
          </nav>
        } />
        {showAdmin && (
          <DialogOverlay className="overlay-start" title="جلسه‌های ذخیره‌شده" onEscape={() => setShowAdmin(false)}>
            <div className="screen">
              <p className="small muted">
                {fa(all.length)} جلسه — {fa(all.filter((s) => !s.exported_at).length)} هنوز خروجی نگرفته
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: ".5rem", flex: 1 }}>
                {all.map((s) => (
                  <div className="jobrow archive-row" key={s.session_id}>
                    <div className="name small">
                      {s.session_id.slice(0, 8)} · {s.interviewer} ·{" "}
                      {s.finished_at ? "تمام" : "ناتمام"}
                      {s.exported_at ? " · خروجی گرفته" : ""}
                    </div>
                    <button className="btn ghost" onClick={() => exportSession(s)}>خروجی</button>
                  </div>
                ))}
              </div>
              <div className="foot">
                <button className="btn primary" disabled={!all.length}
                        onClick={() => exportAll(all)}>خروجی همه</button>
                <button className="btn ghost" onClick={() => setShowAdmin(false)}>بستن</button>
              </div>
            </div>
          </DialogOverlay>
        )}
      </>
    );
  }

  const m = session.cursor.module;

  // SPEC 9 -- a customer arrives mid-session. A pause that locks and resumes
  // exactly is worth more than any animation.
  if (paused) {
    return (
      <DialogOverlay title={COPY.paused}>
        <button className="btn primary" onClick={() => setPaused(false)}>{COPY.resume}</button>
      </DialogOverlay>
    );
  }

  if (observing) return <Suspense fallback={loading}><M07Observe onDone={() => { setObserving(false); }} /></Suspense>;
  if (syncing) return <Suspense fallback={loading}><AdminPanel onDone={() => { setSyncing(false); }} /></Suspense>;

  if (askPin) {
    return (
      <DialogOverlay title="ورود به بخش مشاهده" onEscape={() => { setAskPin(false); setPinTry(""); }}>
        <p className="helper">رمزی را که هنگام آماده‌سازی جلسه انتخاب کردید وارد کنید.</p>
        <input aria-label="رمز جلسه" type="password" className="chip" inputMode="numeric" value={pinTry} autoFocus
               style={{ fontSize: "1.6rem", textAlign: "center", letterSpacing: ".4em" }}
               onChange={(e) => {
                 const v = e.target.value.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/\D/g, "");
                 setPinTry(v);
                 if (v === pin) {
                   setAskPin(false); setPinTry("");
                   if (pinIntent === "sync") setSyncing(true); else setObserving(true);
                 }
               }} />
        <button className="btn ghost" onClick={() => { setAskPin(false); setPinTry(""); }}>انصراف</button>
      </DialogOverlay>
    );
  }

  const body =
    m === "open" ? <M00Open /> :
    m === "profile" ? <M01Profile /> :
    m === "maxdiff" ? <M02MaxDiff /> :
    m === "coins" ? <M03Coins /> :
    m === "cbc" ? <M04CBC /> :
    m === "voice" ? <M05Voice /> :
    m === "reveal" ? <M06Reveal /> :
    <Done onObserve={() => setAskPin(true)}
            pending={pending}
            onSync={() => { setPinIntent("sync"); setAskPin(true); }} />;

  return (
    <>
      <nav className="session-toolbar" aria-label="کنترل جلسه">
      {/* long-press the wordmark + PIN to reach the observation block (SPEC 2.7) */}
      <button
        className="btn quiet"
        aria-label="قهوه‌سنج؛ برای ورود مصاحبه‌گر نگه دارید"
        onPointerDown={() => {
          const t = window.setTimeout(() => { setPinIntent("observe"); setAskPin(true); }, 1200);
          const clear = () => { window.clearTimeout(t); window.removeEventListener("pointerup", clear); };
          window.addEventListener("pointerup", clear);
        }}
      >{COPY.appName}</button>

      {m !== "done" && (
        <button className="btn quiet"
                onClick={() => setPaused(true)}>{COPY.pause}</button>
      )}
      </nav>
      <Suspense fallback={loading}>{body}</Suspense>
      {m === "cbc" && <RotateHint />}
    </>
  );
}

function Done({ onObserve, pending, onSync }:
               { onObserve: () => void; pending: number; onSync: () => void }) {
  const s = useSession((st) => st.session)!;
  const [saved, setSaved] = useState(!!s.exported_at);
  return (
    <div className="screen done-screen" style={{ justifyContent: "center", textAlign: "center" }}>
      <h1>پاسخ‌ها ثبت شد</h1>
      <p className="muted">ممنون از همراهی‌ات. حالا تبلت را به مصاحبه‌گر تحویل بده.</p>
      <p className="helper">مصاحبه‌گر: نشان قهوه‌سنج را نگه دارید و با رمز جلسه، بخش مشاهده را تکمیل کنید. سپس خروجی بگیرید.</p>
      {pending > 0 && (
        <div className="notice" style={{ textAlign: "start" }}>
          <strong>{new Intl.NumberFormat("fa-IR").format(pending)} جلسه هنوز آپلود نشده.</strong>{" "}
          روی همین گوشی امن است، ولی فقط همین‌جاست.
        </div>
      )}
      <div className="foot" style={{ flexDirection: "column" }}>
        <button className="btn ghost" onClick={onObserve}>ورود مصاحبه‌گر به بخش مشاهده</button>
        <button className="btn ghost" style={{ marginTop: ".5rem" }} onClick={onSync}>
          پنل همگام‌سازی{pending > 0 ? ` (${new Intl.NumberFormat("fa-IR").format(pending)})` : ""}
        </button>
        <button className="btn primary" onClick={async () => { await exportSession(s); setSaved(true); }}>
          {saved ? "دوباره خروجی بگیر" : "خروجی این جلسه"}
        </button>
        {saved && <p className="small muted" style={{ marginTop: ".75rem" }}>
          فایل ذخیره شد. تا وقتی خروجی نگرفته‌اید هیچ جلسه‌ای پاک نمی‌شود.
        </p>}
        <button className="btn ghost" style={{ marginTop: ".5rem" }}
                onClick={() => window.location.reload()}>جلسهٔ بعدی</button>
      </div>
    </div>
  );
}
