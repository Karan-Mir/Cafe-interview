import { useEffect, useRef, useState } from "react";
import { useSession } from "../core/store";
import { db } from "../core/db";
import { COPY } from "../content/items";
import { fa } from "../core/fa";
import { SectionIntro } from "../ui/Illustration";

const CAP_S = 45;

/** SPEC 2.5 -- one open question, 45 s cap. The only escape hatch from our own
 *  fourteen ideas. Voice is the default; typing Persian on a borrowed tablet is
 *  a completion-rate killer, so the keyboard is the fallback, not the norm. */
export default function M05Voice() {
  const s = useSession((st) => st.session)!;
  const patch = useSession((st) => st.patch);
  const goto = useSession((st) => st.goto);
  const [rec, setRec] = useState(false);
  const [secs, setSecs] = useState(0);
  const [have, setHave] = useState(!!s.open.audio_ref);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState(s.open.text ?? "");
  const mr = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | null>(null);
  const elapsed = useRef(0);
  const [audioUrl, setAudioUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    let url = "";
    if (s.open.audio_ref) db.audio.get(s.open.audio_ref).then((entry) => {
      if (entry && active) { url = URL.createObjectURL(entry.blob); setAudioUrl(url); }
    });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [s.open.audio_ref, have, busy]);
  useEffect(() => () => {
    if (timer.current) window.clearInterval(timer.current);
    if (mr.current?.state === "recording") mr.current.stop();
    mr.current?.stream.getTracks().forEach((track) => track.stop());
  }, []);

  const stop = () => {
    if (mr.current?.state !== "recording") return;
    setBusy(true);
    mr.current.stop();
    if (timer.current) window.clearInterval(timer.current);
    setRec(false);
  };

  const start = async () => {
    setError(""); setBusy(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      chunks.current = [];
      r.ondataavailable = (e) => chunks.current.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        try {
        const blob = new Blob(chunks.current, { type: r.mimeType || "audio/webm" });
        const id = `${s.session_id}-open`;
        await db.audio.put({ id, blob });
        await patch((d) => { d.open.audio_ref = id; d.open.duration_s = elapsed.current; });
        setHave(true);
        } catch { setError("ذخیرهٔ صدا انجام نشد. دوباره تلاش کن یا پاسخت را بنویس."); }
        finally { setBusy(false); }
      };
      mr.current = r; elapsed.current = 0; r.start(); setSecs(0); setRec(true); setBusy(false);
      timer.current = window.setInterval(() => {
        elapsed.current += 1; setSecs(elapsed.current);
        if (elapsed.current >= CAP_S) stop();
      }, 1000);
    } catch {
      setBusy(false); setError("دسترسی به میکروفن ممکن نشد. می‌توانی همین‌جا پاسخت را بنویسی.");
      setTyping(true);                         // no mic or permission denied
    }
  };

  const done = have || text.trim().length > 0;

  return (
    <div className="screen">
      <SectionIntro kind="voice" title={COPY.voiceTitle} description="این بخش برای ایده‌ای است که شاید بین گزینه‌ها ندیدی. تا ۴۵ ثانیه صدایت را ضبط کن یا چند جمله بنویس. لطفاً نام و اطلاعات تماس را در پاسخ نیاور." step="ایدهٔ آزاد" />
      <h2 className="voice-question">{COPY.voicePrompt}</h2>
      {error && <p role="alert" className="notice">{error}</p>}

      {!typing ? (
        <div style={{ display: "grid", placeItems: "center", gap: "1rem", flex: 1 }}>
          <button disabled={busy} className={"voice-object" + (rec ? " recording" : "")} type="button" onClick={rec ? stop : start}
                  style={{ width: 168, height: 168, borderRadius: "50%",
                           background: rec ? "var(--persimmon)" : "var(--moss)",
                           color: "#fff", fontSize: "1.2rem", fontWeight: 700 }}>
            {rec ? COPY.voiceStop : have ? COPY.voiceAgain : COPY.voiceRecord}
          </button>
          <div className={"recording-bars" + (rec ? " active" : "")} aria-hidden="true">{Array.from({length:13},(_,i)=><i key={i} style={{animationDelay:`${i*.09}s`}}/>)}</div>
          {busy && <p role="status">در حال آماده‌سازی یا ذخیرهٔ صدا…</p>}
          {audioUrl && !rec && !busy && <div className="audio-preview"><p className="helper">پاسخت ذخیره شد. پیش از ادامه می‌توانی آن را گوش کنی.</p><audio controls src={audioUrl} aria-label="شنیدن پاسخ ضبط‌شده" /></div>}
          {(rec || have) && (
            <div className="small muted" style={{ fontVariantNumeric: "tabular-nums" }}>
              {fa(rec ? secs : s.open.duration_s)} / {fa(CAP_S)} ثانیه
            </div>
          )}
          <button className="btn quiet" disabled={rec || busy} onClick={() => setTyping(true)}>{COPY.voiceType}</button>
        </div>
      ) : (
        <div className="field"><textarea aria-label="پاسخ تو" placeholder="دوست دارم یک دستیار کمکم کند که…" value={text} onChange={(e) => setText(e.target.value)} rows={6}
                  style={{ width: "100%", fontSize: "1.1rem", padding: ".8rem",
                           borderRadius: "var(--r)", border: "2px solid var(--hairline)",
                           fontFamily: "inherit" }} /><button className="btn quiet" onClick={() => setTyping(false)}>بازگشت به ضبط صدا</button></div>
      )}

      <div className="foot">
        <button className="btn primary" disabled={!done || rec || busy}
                onClick={async () => {
                  if (typing) await patch((d) => { d.open.text = text.trim(); });
                  goto("reveal", 0);
                }}>
          {COPY.next}
        </button>
      </div>
    </div>
  );
}
