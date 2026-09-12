import { useEffect, useState } from "react";
import { Field } from "../ui/bits";
import { fa } from "../core/fa";
import { supabase, isConfigured, signIn, signOut, ping, currentUser } from "../core/supabase";
import { syncNow, pendingCount, deviceId, setDeviceId, type SyncResult } from "../core/sync";
import { MAXDIFF_ITEMS } from "../content/items";

interface Row {
  session_id: string; device: string; interviewer: string | null;
  started_at: string | null; finished_at: string | null; uploaded_at: string;
  design_version: string; cafe_type: string | null; seats: number | null;
  price_ref_toman: number | null; price_ref_item: string | null;
  completed: boolean | null; trap_failed: boolean | null; straightlined: boolean | null;
  fast_tasks: number | null; median_latency_ms: number | null;
  cbc_tasks: number; maxdiff_sets: number;
  open_text: string | null; audio_ref: string | null; duration_s: number | null;
}

const dt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" }) : "—";

export default function AdminPanel({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [user, setUser] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [rows, setRows] = useState<Row[]>([]);
  const [open, setOpen] = useState<Row | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [pend, setPend] = useState(0);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [probe, setProbe] = useState<string>("");
  const [device, setDevice] = useState(deviceId());

  useEffect(() => { currentUser().then((u) => setUser(u?.email ?? null)); }, []);
  useEffect(() => { pendingCount().then(setPend); }, [result, user]);

  const load = async () => {
    if (!supabase) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("session_summary").select("*").order("uploaded_at", { ascending: false });
    if (error) setErr(error.message); else { setRows((data ?? []) as Row[]); setErr(""); }
    setBusy(false);
  };
  useEffect(() => { if (user) void load(); }, [user]);

  const openRow = async (r: Row) => {
    setOpen(r); setDetail(null);
    const { data } = await supabase!.from("sessions").select("doc").eq("session_id", r.session_id).maybeSingle();
    setDetail((data?.doc ?? null) as Record<string, unknown> | null);
  };

  /** Every session as the exact JSON array analyse.py reads. The estimator stays
   *  in Python -- reimplementing a conditional logit in the browser would give
   *  two answers to the same question and no way to tell which is right. */
  const exportJson = async () => {
    const { data } = await supabase!.from("sessions").select("doc").order("uploaded_at");
    const docs = (data ?? []).map((d: { doc: unknown }) => d.doc);
    const blob = new Blob([JSON.stringify(docs, null, 1)], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `qahvesanj-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const exportCsv = () => {
    const cols: (keyof Row)[] = ["session_id","device","interviewer","started_at","finished_at",
      "cafe_type","seats","price_ref_item","price_ref_toman","duration_s","cbc_tasks","maxdiff_sets",
      "completed","trap_failed","straightlined","fast_tasks","median_latency_ms","open_text"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `qahvesanj-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // ── not signed in ──────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="screen">
        <div className="eyebrow">پنل مدیریت</div>
        <h2>ورود</h2>
        {!isConfigured && (
          <div className="notice"><strong>اتصال به سرور پیکربندی نشده.</strong> فایل <code>.env.local</code> را پر کنید.</div>
        )}
        <Field label="ایمیل">
          <input className="chip" style={{ width: "100%", direction: "ltr" }} type="email"
                 autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="رمز">
          <input className="chip" style={{ width: "100%", direction: "ltr" }} type="password"
                 autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        {err && <div className="notice">{err}</div>}
        {probe && <div className="notice ok">{probe}</div>}
        <div className="foot" style={{ flexWrap: "wrap" }}>
          <button className="btn ghost" disabled={busy}
                  onClick={async () => { setBusy(true); setProbe((await ping()).detail); setBusy(false); }}>
            آزمایش اتصال
          </button>
          <button className="btn primary" disabled={busy || !email || !pw}
                  onClick={async () => {
                    setBusy(true); setErr("");
                    const r = await signIn(email, pw);
                    if (!r.ok) setErr(r.detail); else setUser((await currentUser())?.email ?? null);
                    setBusy(false);
                  }}>ورود</button>
        </div>
        <div className="foot"><button className="btn quiet" onClick={onDone}>بازگشت</button></div>
      </div>
    );
  }

  // ── one café ───────────────────────────────────────────────────────────
  if (open) {
    const md = (detail?.maxdiff as { responses?: { best: number; worst: number }[] })?.responses ?? [];
    const tally = new Map<number, number>();
    md.forEach((r) => {
      tally.set(r.best, (tally.get(r.best) ?? 0) + 1);
      tally.set(r.worst, (tally.get(r.worst) ?? 0) - 1);
    });
    const ranked = [...tally.entries()].sort((a, b) => b[1] - a[1]);
    return (
      <div className="screen">
        <div className="eyebrow">{open.cafe_type ?? "کافه"} · {dt(open.started_at)}</div>
        <h2>{open.session_id.slice(0, 8)}</h2>
        <div className="notice ok" style={{ textAlign: "start" }}>
          مصاحبه‌گر {open.interviewer} · {open.device} · {open.seats ?? "—"} صندلی ·
          مرجع قیمت {open.price_ref_item} {fa(open.price_ref_toman ?? 0)} تومان ·
          مدت {open.duration_s ? fa(Math.round(open.duration_s / 60)) : "—"} دقیقه
        </div>
        {open.open_text && (
          <Field label="پاسخ باز"><p style={{ lineHeight: 1.7 }}>{open.open_text}</p></Field>
        )}
        {ranked.length > 0 && (
          <Field label="ایده‌ها — امتیاز بهترین منهای بدترین">
            <div style={{ display: "flex", flexDirection: "column", gap: ".25rem" }}>
              {ranked.filter(([, v]) => v !== 0).map(([i, v]) => (
                <div key={i} style={{ display: "flex", gap: ".5rem", fontSize: ".95rem" }}>
                  <span style={{ minWidth: "2.5rem", fontWeight: 700,
                                 color: v > 0 ? "var(--ok)" : "var(--risk)" }}>
                    {v > 0 ? "+" : ""}{fa(v)}
                  </span>
                  <span>{MAXDIFF_ITEMS[i]?.title ?? i}</span>
                </div>
              ))}
            </div>
          </Field>
        )}
        <details><summary className="small muted">سند کامل</summary>
          <pre style={{ direction: "ltr", fontSize: ".68rem", overflow: "auto",
                        maxHeight: "40vh", background: "var(--surface-2)", padding: ".6rem" }}>
            {detail ? JSON.stringify(detail, null, 1) : "…"}
          </pre>
        </details>
        <div className="foot"><button className="btn primary" onClick={() => setOpen(null)}>بازگشت به فهرست</button></div>
      </div>
    );
  }

  // ── the list ───────────────────────────────────────────────────────────
  const flagged = rows.filter((r) => r.trap_failed || r.straightlined || (r.fast_tasks ?? 0) >= 5).length;
  const byDevice = [...new Set(rows.map((r) => r.device))];
  return (
    <div className="screen">
      <div className="eyebrow">پنل مدیریت · {user}</div>
      <h2>{fa(rows.length)} کافه جمع‌آوری شده</h2>

      {pend > 0 && (
        <div className="notice">
          <strong>{fa(pend)} جلسه روی این گوشی هنوز آپلود نشده.</strong>
        </div>
      )}
      {err && <div className="notice">{err}</div>}
      {result && (
        <div className={"notice" + (result.failed === 0 ? " ok" : "")}>
          {fa(result.uploaded)} آپلود شد{result.failed ? ` · ${fa(result.failed)} ناموفق` : ""}
          {result.errors.slice(0, 2).map((e, i) => <div key={i} className="small" style={{ direction: "ltr" }}>{e}</div>)}
        </div>
      )}

      <div className="notice ok" style={{ textAlign: "start" }}>
        {byDevice.map((d) => `${d}: ${fa(rows.filter((r) => r.device === d).length)}`).join(" · ") || "—"}
        {flagged > 0 && <> · <strong>{fa(flagged)} نشان‌دار</strong></>}
        {rows.length < 40 && <> · زیر ۴۰ کافه فقط ترتیب را گزارش کنید، نه قیمت</>}
      </div>

      <Field label="کد این گوشی — همان کدی که در صفحهٔ آماده‌سازی می‌بینید">
        <input className="chip" style={{ width: "100%", direction: "ltr" }} value={device}
               placeholder="phone-a" onChange={(e) => { setDevice(e.target.value); setDeviceId(e.target.value); }} />
      </Field>

      <div className="tablewrap" style={{ overflowX: "auto", maxHeight: "45vh", overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: ".85rem" }}>
          <thead><tr style={{ textAlign: "start" }}>
            {["کافه", "صندلی", "مصاحبه‌گر", "زمان", "وضعیت"].map((h) => (
              <th key={h} style={{ textAlign: "start", padding: ".4rem", position: "sticky", top: 0,
                                   background: "var(--surface-2)" }}>{h}</th>))}
          </tr></thead>
          <tbody>
            {rows.map((r) => {
              const bad = r.trap_failed || r.straightlined || (r.fast_tasks ?? 0) >= 5;
              return (
                <tr key={r.session_id} onClick={() => openRow(r)} style={{ cursor: "pointer" }}>
                  <td style={{ padding: ".4rem" }}>{r.cafe_type ?? "—"}</td>
                  <td style={{ padding: ".4rem" }}>{r.seats ? fa(r.seats) : "—"}</td>
                  <td style={{ padding: ".4rem" }}>{r.interviewer ?? "—"}</td>
                  <td style={{ padding: ".4rem", whiteSpace: "nowrap" }}>{dt(r.started_at)}</td>
                  <td style={{ padding: ".4rem", color: bad ? "var(--risk)" : "var(--ok)" }}>
                    {bad ? "نشان‌دار" : r.completed ? "تمام" : "ناتمام"}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !busy && (
              <tr><td colSpan={5} style={{ padding: "1rem", textAlign: "center" }} className="muted">
                هنوز کافه‌ای ثبت نشده
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="foot" style={{ flexWrap: "wrap" }}>
        <button className="btn ghost" disabled={busy} onClick={load}>تازه‌سازی</button>
        <button className="btn primary" disabled={busy}
                onClick={async () => { setBusy(true); setResult(await syncNow()); await load(); setBusy(false); }}>
          ارسال {pend > 0 ? `(${fa(pend)})` : ""}
        </button>
      </div>
      <div className="foot" style={{ flexWrap: "wrap" }}>
        <button className="btn ghost" disabled={!rows.length} onClick={exportCsv}>خروجی CSV</button>
        <button className="btn ghost" disabled={!rows.length} onClick={exportJson}>خروجی برای تحلیل</button>
        <button className="btn quiet" onClick={async () => { await signOut(); setUser(null); }}>خروج از حساب</button>
        <button className="btn quiet" onClick={onDone}>بازگشت</button>
      </div>
    </div>
  );
}
