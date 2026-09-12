import { useSession } from "../core/store";
import { Chip, Stepper, Field } from "../ui/bits";
import { SectionIntro } from "../ui/Illustration";

const MENU = ["چاپی", "تخته", "QR", "ترکیبی"];
const ORDER = ["روی کاغذ نوشت", "وارد صندوق کرد", "تبلت یا موبایل", "حفظ کرد", "مشتری سر صندوق"];
const LOC = ["خیابان اصلی", "فرعی", "پاساژ", "حیاط"];
const SIGN = ["خوب", "متوسط", "ضعیف"];
const QUEUE = ["نبود", "کوتاه", "بلند"];
const PLAYED = ["مالک", "مدیر", "کارمند"];

/** SPEC 2.7 -- interviewer only, PIN-gated, filled in AFTER the tablet comes back.
 *  Costs no interview time, which is why it was expanded rather than trimmed. */
export default function M07Observe({ onDone }: { onDone: () => void }) {
  const s = useSession((st) => st.session)!;
  const patch = useSession((st) => st.patch);
  const o = s.observation;
  const set = (k: string, v: unknown) => patch((d) => { (d.observation as Record<string, unknown>)[k] = v; });

  return (
    <div className="screen">
      <SectionIntro kind="report" title="یادداشت‌های بازدید" description="این بخش مخصوص مصاحبه‌گر است. فقط مواردی را ثبت کنید که دیده‌اید یا از منو و تابلوی ساعت کاری خوانده‌اید. اگر نمی‌دانید، خالی بگذارید." step="مشاهدهٔ کافه" />

      <div className="notice">
        <strong>روش سفارش‌گیری را مشاهده کنید.</strong> ببینید کارکنان سفارش مشتری را کجا ثبت می‌کنند؛ برای پر کردن این بخش از آن‌ها سؤال نکنید.
      </div>

      <Field label="چه کسی بازی کرد؟">
        <div className="chips">{PLAYED.map((v) =>
          <Chip key={v} on={s.played_by === v} onClick={() => patch((d) => { d.played_by = v; })}>{v}</Chip>)}</div>
      </Field>

      <Field label="سفارش را چطور گرفتند؟">
        <div className="chips">{ORDER.map((v) =>
          <Chip key={v} on={o.order_taking === v} onClick={() => set("order_taking", v)}>{v}</Chip>)}</div>
      </Field>

      <Field label="تعداد آیتم منو"><Stepper value={o.menu_items ?? 0} set={(n) => set("menu_items", n)} max={300} /></Field>
      <Field label="ساعت کاری در روز"><Stepper value={o.hours_open ?? 0} set={(n) => set("hours_open", n)} max={24} /></Field>
      <Field label="نفرات نشسته در لحظهٔ بازدید"><Stepper value={o.occupancy ?? 0} set={(n) => set("occupancy", n)} max={300} /></Field>
      <Field label="کافهٔ دیگر در دو دقیقه پیاده"><Stepper value={o.competitors_2min ?? 0} set={(n) => set("competitors_2min", n)} max={40} /></Field>

      <Field label="منو"><div className="chips">{MENU.map((v) =>
        <Chip key={v} on={o.menu_type === v} onClick={() => set("menu_type", v)}>{v}</Chip>)}</div></Field>
      <Field label="موقعیت"><div className="chips">{LOC.map((v) =>
        <Chip key={v} on={o.location === v} onClick={() => set("location", v)}>{v}</Chip>)}</div></Field>
      <Field label="تابلو"><div className="chips">{SIGN.map((v) =>
        <Chip key={v} on={o.signage === v} onClick={() => set("signage", v)}>{v}</Chip>)}</div></Field>
      <Field label="صف"><div className="chips">{QUEUE.map((v) =>
        <Chip key={v} on={o.queue === v} onClick={() => set("queue", v)}>{v}</Chip>)}</div></Field>

      {([{key:"pos_seen",label:"صندوق دیجیتال"},{key:"wifi",label:"وای‌فای"},{key:"outlets",label:"پریز کنار میز"}] as const).map(({key,label}) => <Field key={key} label={label}><div className="chips">
        <Chip on={o[key] === true} onClick={() => set(key,true)}>دیده شد</Chip>
        <Chip on={o[key] === false} onClick={() => set(key,false)}>وجود نداشت</Chip>
        <Chip on={o[key] == null} onClick={() => set(key,null)}>مشخص نیست</Chip>
      </div></Field>)}

      <div className="foot">
        <button className="btn primary" onClick={onDone}>ثبت و بستن</button>
      </div>
    </div>
  );
}
