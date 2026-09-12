import { useEffect, useState } from "react";
import { useSession } from "./core/store";
import { verifyDesigns } from "./core/designs";
import { allSessions, unfinished } from "./core/db";
import { exportSession, exportAll } from "./core/export";
import { syncInBackground, pendingCount } from "./core/sync";
import { COPY } from "./content/items";
import { fa } from "./core/fa";
import type { Session } from "./core/types";

import Preflight from "./modules/Preflight";
import M00Open from "./modules/M00Open";
import M01Profile from "./modules/M01Profile";
import M02MaxDiff from "./modules/M02MaxDiff";
import M03Coins from "./modules/M03Coins";
import M04CBC from "./modules/M04CBC";
import M05Voice from "./modules/M05Voice";
import M06Reveal from "./modules/M06Reveal";
import M07Observe from "./modules/M07Observe";
import AdminPanel from "./modules/AdminPanel";
import RotateHint from "./ui/RotateHint";

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
    syncInBackground();
    const back = () => syncInBackground();
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

  if (!gate) return <div className="overlay"><p>…</p></div>;

  if (!gate.ok) {
    return (
      <div className="overlay">
        <h2 style={{ color: "var(--risk)" }}>فایل طرح با امضای خودش نمی‌خواند</h2>
        <p className="small muted" style={{ maxWidth: "28rem" }}>
          این تبلت نسخهٔ متفاوتی از طرح را حمل می‌کند. اگر با این نسخه مصاحبه بگیرید،
          داده‌ها با بقیهٔ تبلت‌ها قابل ادغام نخواهد بود و هیچ هشداری هم در تحلیل
          ظاهر نمی‌شود. تا جایگزینی فایل، مصاحبه نگیرید.
        </p>
        <code className="small">{gate.detail}</code>
      </div>
    );
  }

  if (!session) {
    if (syncing) return <AdminPanel onDone={() => setSyncing(false)} />;
    return (
      <>
        {resumable && (
          <div className="overlay">
            <h2>یک جلسهٔ ناتمام هست</h2>
            <p className="small muted">
              شروع {new Date(resumable.started_at).toLocaleString("fa-IR")}
            </p>
            <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap", justifyContent: "center" }}>
              <button className="btn primary" onClick={() => { resume(resumable); setResumable(null); }}>
                ادامه بده
              </button>
              <button className="btn ghost" onClick={() => setResumable(null)}>جلسهٔ تازه</button>
            </div>
          </div>
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
          <div className="overlay" style={{ placeItems: "start", overflow: "auto" }}>
            <div className="screen">
              <h2>جلسه‌های ذخیره‌شده</h2>
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
          </div>
        )}
      </>
    );
  }

  const m = session.cursor.module;

  // SPEC 9 -- a customer arrives mid-session. A pause that locks and resumes
  // exactly is worth more than any animation.
  if (paused) {
    return (
      <div className="overlay">
        <h2>{COPY.paused}</h2>
        <button className="btn primary" onClick={() => setPaused(false)}>{COPY.resume}</button>
      </div>
    );
  }

  if (observing) return <M07Observe onDone={() => { setObserving(false); }} />;
  if (syncing) return <AdminPanel onDone={() => { setSyncing(false); }} />;

  if (askPin) {
    return (
      <div className="overlay">
        <h2>ورود به بخش مشاهده</h2>
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
      </div>
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
      {body}
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
