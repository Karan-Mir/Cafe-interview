import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "../core/store";
import { Chip, Field } from "../ui/bits";
import { fa } from "../core/fa";
import { pendingCount, deviceId, setDeviceId } from "../core/sync";
import { SectionIntro } from "../ui/Illustration";

const ITEMS = ["اسپرسو", "قهوهٔ ساده", "چای"];

/** SPEC 2.0 -- the interviewer's screen. Not part of the player's flow: this is
 *  filled in BEFORE the tablet is handed over. */
export default function Preflight({ onReady, tools }: { onReady: (pin: string) => void; tools?: ReactNode }) {
  const [pending, setPending] = useState(0);
  useEffect(() => { pendingCount().then(setPending); }, []);
  const begin = useSession((s) => s.begin);
  const [who, setWho] = useState("");
  // Single source of truth: localStorage `qz.device`, shared with the admin
  // panel. Previously this defaulted to "tab-01" and kept its own state, so
  // whichever screen was touched last decided how a session was labelled --
  // and with two collectors that is the field that says whose data is whose.
  const [device, setDevice] = useState(deviceId());
  const [pin, setPin] = useState("");
  const [item, setItem] = useState(ITEMS[0]);
  const [toman, setToman] = useState(0);

  // A phone with no name produces rows nobody can attribute. Required.
  const ready = who.trim().length >= 2 && device.trim().length >= 2
    && pin.length >= 4 && toman >= 10000;

  return (
    <div className="screen preflight-screen">
      <SectionIntro kind="cafe" title="برای یک گفت‌وگوی خوب آماده شویم" description="این بخش را مصاحبه‌گر تکمیل می‌کند. پس از شروع جلسه، تبلت را به صاحب یا مدیر کافه بدهید." step="آماده‌سازی جلسه" />

      {pending > 0 && (
        <div className="notice">
          <strong>{fa(pending)} جلسه هنوز آپلود نشده.</strong> روی همین گوشی امن است،
          ولی فقط همین‌جاست — از پنل همگام‌سازی بفرست.
        </div>
      )}

      <Field label="حروف اول اسم شما">
        <input aria-label="حروف اول نام مصاحبه‌گر" autoComplete="off" className="chip" style={{ width: "100%" }} value={who}
               onChange={(e) => setWho(e.target.value)} placeholder="مثلاً ک.م" />
      </Field>

      <Field label="کد این گوشی">
        <input aria-label="کد این گوشی" dir="ltr" className="chip" style={{ width: "100%" }} value={device}
               placeholder="phone-a"
               onChange={(e) => { setDevice(e.target.value); setDeviceId(e.target.value); }} />
        <p className="helper">
          یک بار برای همیشه روی این گوشی تنظیم می‌شود و در هر جلسه ثبت می‌گردد.
          هر جمع‌آورنده باید کد متفاوتی داشته باشد — همین است که مشخص می‌کند کدام
          داده مال کیست.
        </p>
      </Field>

      <Field label="رمز ۴ تا ۶ رقمی این جلسه">
        <input aria-label="رمز جلسه" type="password" autoComplete="new-password" className="chip" style={{ width: "100%" }} value={pin} inputMode="numeric"
               maxLength={6} onChange={(e) => setPin(e.target.value.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))).replace(/\D/g, ""))} />
        <p className="helper">رمز را به خاطر بسپارید؛ برای باز کردن بخش مشاهده، نشان قهوه‌سنج را نگه دارید و این رمز را وارد کنید.</p>
      </Field>

      <div className="notice">
        <strong>قیمت مرجع را از روی منو بردارید. نپرسید.</strong><br />
        اسپرسو؛ اگر نبود هر قهوهٔ ساده؛ اگر آن هم نبود چای. صاحب کافه هیچ عدد مالی
        به شما نمی‌دهد — این تمام قولی است که سر در گفت‌وگو داده‌ایم.
      </div>

      <Field label="کدام آیتم؟">
        <div className="chips">
          {ITEMS.map((i) => <Chip key={i} on={item === i} onClick={() => setItem(i)}>{i}</Chip>)}
        </div>
      </Field>

      <Field label="قیمت روی منو (تومان)">
        <input aria-label="قیمت مرجع به تومان" className="chip" style={{ width: "100%", fontVariantNumeric: "tabular-nums" }}
               inputMode="numeric" value={toman ? fa(toman) : ""}
               onChange={(e) => setToman(Number(e.target.value.replace(/[^\d۰-۹]/g, "")
                 .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))) || 0)}
               placeholder="مثلاً ۹۵۰۰۰" />
        <p className="helper">مبلغ را به تومان وارد کنید، نه ریال. حداقل مبلغ قابل ثبت ۱۰٬۰۰۰ تومان است.</p>
      </Field>

      <div className="preflight-actions">
        <div className="foot">
          <button className="btn primary" disabled={!ready}
                  onClick={async () => { await begin(who.trim(), device.trim(), item, toman); onReady(pin); }}>
            شروع جلسه
          </button>
        </div>
        {tools}
      </div>
    </div>
  );
}
