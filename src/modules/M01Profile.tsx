import { useSession } from "../core/store";
import { Chip, Stepper, Field, CafeCard, Progress } from "../ui/bits";
import { COPY } from "../content/items";
import { SectionIntro } from "../ui/Illustration";

const BRANCHES = ["یک", "دو", "سه یا بیشتر", "در فکر شعبهٔ بعدی"];
const SHIFTS = ["یک", "دو"];
const TYPES = ["قهوه‌محور", "کافه‌رستوران", "سنتی", "بیرون‌بر محور", "قنادی", "ترکیبی"];
const POS = ["ندارم", "صندوق ساده", "نرم‌افزار فروش", "نرم‌افزار با گزارش"];

/** SPEC 2.1 -- four screens, chips and steppers only, NO text inputs. Every tap
 *  builds the café card at the top, because that card is what they get back. */
export default function M01Profile() {
  const s = useSession((st) => st.session)!;
  const patch = useSession((st) => st.patch);
  const goto = useSession((st) => st.goto);
  const step = s.cursor.step;
  const p = s.profile;

  const set = (k: string, v: unknown) => patch((d) => { (d.profile as Record<string, unknown>)[k] = v; });

  const done =
    step === 0 ? p.years !== undefined && !!p.branches :
    step === 1 ? p.staff_ft !== undefined && !!p.shifts :
    step === 2 ? !!p.type && p.seats !== undefined :
    !!p.pos;

  return (
    <div className="screen">
      <Progress n={step + 1} of={4} />
      <SectionIntro kind="cafe" title={["کافه‌ات را معرفی کن", "چه کسانی در کافه کار می‌کنند؟", "فضای کافه‌ات چه شکلی است؟", "فروش‌ها را چطور ثبت می‌کنی؟"][step]} description="گزینه‌های مناسب را انتخاب کن. برای تغییر تعداد، از + و − استفاده کن یا روی عدد بزن و آن را بنویس." step={`کارت کافه · ${["۱", "۲", "۳", "۴"][step]} از ۴`} />
      <CafeCard p={p as Record<string, unknown>} />

      {step === 0 && <>
        <Field label="چند سال است این کافه باز است؟">
          <Stepper value={p.years ?? 0} set={(n) => set("years", n)} max={60} />
          <Chip on={p.years === 0} onClick={() => set("years", 0)}>کمتر از یک سال</Chip>
        </Field>
        <Field label="چند شعبه؟">
          <div className="chips">{BRANCHES.map((b) =>
            <Chip key={b} on={p.branches === b} onClick={() => set("branches", b)}>{b}</Chip>)}</div>
        </Field>
      </>}

      {step === 1 && <>
        <Field label="نیروی تمام‌وقت">
          <Stepper value={p.staff_ft ?? 0} set={(n) => set("staff_ft", n)} max={40} />
          <Chip on={p.staff_ft === 0} onClick={() => set("staff_ft", 0)}>نیروی تمام‌وقت نداریم</Chip>
        </Field>
        <Field label="نیروی پاره‌وقت">
          <Stepper value={p.staff_pt ?? 0} set={(n) => set("staff_pt", n)} max={40} />
        </Field>
        <Field label="چند شیفت در روز؟">
          <div className="chips">{SHIFTS.map((b) =>
            <Chip key={b} on={p.shifts === b} onClick={() => set("shifts", b)}>{b}</Chip>)}</div>
        </Field>
      </>}

      {step === 2 && <>
        <Field label="کافه‌ات را چه می‌دانی؟">
          <div className="chips">{TYPES.map((b) =>
            <Chip key={b} on={p.type === b} onClick={() => set("type", b)}>{b}</Chip>)}</div>
        </Field>
        <Field label="چند صندلی؟">
          <Stepper value={p.seats ?? 0} set={(n) => set("seats", n)} max={300} />
          <Chip on={p.seats === 0} onClick={() => set("seats", 0)}>صندلی نداریم؛ فقط بیرون‌بر</Chip>
        </Field>
      </>}

      {step === 3 && <>
        <Field label="صندوق و نرم‌افزار">
          <div className="chips">{POS.map((b) =>
            <Chip key={b} on={p.pos === b} onClick={() => set("pos", b)}>{b}</Chip>)}</div>
        </Field>
      </>}

      <div className="foot">
        {step > 0 && <button className="btn ghost" onClick={() => goto("profile", step - 1)}>{COPY.back}</button>}
        <button className="btn primary" disabled={!done} aria-describedby={!done ? "profile-next-hint" : undefined}
                onClick={() => (step < 3 ? goto("profile", step + 1) : goto("maxdiff", 0))}>
          {COPY.next}
        </button>
      </div>
      {!done && <p id="profile-next-hint" className="action-hint" role="status">برای ادامه، به همهٔ سؤال‌های این بخش جواب بده.</p>}
    </div>
  );
}
