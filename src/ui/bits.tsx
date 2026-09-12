import { useId, type ReactNode } from "react";

export function Chip({ on, children, onClick }: { on: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button className="chip" aria-pressed={on} onClick={onClick} type="button">{children}</button>
  );
}

export function Stepper({ value, set, min = 0, max = 99, step = 1 }: {
  value: number; set: (n: number) => void; min?: number; max?: number; step?: number;
}) {
  const nf = new Intl.NumberFormat("fa-IR");
  return (
    <div className="stepper">
      <button type="button" aria-label="کمتر" disabled={value <= min} onClick={() => set(Math.max(min, value - step))}>−</button>
      <input className="val" aria-label="تعداد" inputMode="numeric" value={nf.format(value)} onChange={(e) => {
        const raw = e.target.value.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/[^0-9]/g, "");
        set(Math.min(max, Math.max(min, Number(raw))));
      }} />
      <button type="button" aria-label="بیشتر" disabled={value >= max} onClick={() => set(Math.min(max, value + step))}>+</button>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return <div className="field" role="group" aria-labelledby={id}><label id={id}>{label}</label>{children}</div>;
}

export function Progress({ n, of }: { n: number; of: number }) {
  return (
    <div className="progress" aria-hidden>
      {Array.from({ length: of }, (_, i) => <i key={i} className={i < n ? "on" : ""} />)}
    </div>
  );
}

/** The café card that fills in as they go (SPEC 2.1, 7). Progress as an object
 *  they are building, never a bar and never a percentage. */
export function CafeCard({ p }: { p: Record<string, unknown> }) {
  const nf = new Intl.NumberFormat("fa-IR");
  const slot = (k: string, v: unknown, unit = "") => (
    <span className={"slot" + (v !== undefined && v !== null && v !== "" ? " filled" : "")} key={k}>
      <span className="k">{k} </span>
      {v === undefined || v === null || v === "" ? "—" : (typeof v === "number" ? nf.format(v) : String(v)) + unit}
    </span>
  );
  return (
    <div className="cafecard">
      <span className="card-emblem" aria-hidden="true">ق</span>
      {slot("نوع", p.type)}
      {slot("سابقه", p.years, " سال")}
      {slot("صندلی", p.seats)}
      {slot("نیرو", p.staff_ft === undefined ? undefined : (p.staff_ft as number) + (p.staff_pt as number ?? 0))}
      {slot("شعبه", p.branches)}
      {slot("صندوق", p.pos)}
    </div>
  );
}
