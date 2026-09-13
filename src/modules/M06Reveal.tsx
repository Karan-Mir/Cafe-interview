import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useSession } from "../core/store";
import { COPY } from "../content/items";
import { fa } from "../core/fa";
import bench from "../../design/benchmarks.json";
import { SectionIntro, Illustration } from "../ui/Illustration";

type Band = { p25: number; p50: number; p75: number; n: number };
const B = bench as unknown as Record<string, Band | number | string | null | string[]>;

const BARS: { key: string; label: string; get: (s: Record<string, unknown>) => number | undefined }[] = [
  { key: "price_ref", label: "قیمت", get: (p) => p.price_ref_toman as number },
  { key: "seats", label: "صندلی", get: (p) => p.seats as number },
  { key: "staff", label: "نیرو", get: (p) => ((p.staff_ft as number) ?? 0) + ((p.staff_pt as number) ?? 0) },
  { key: "menu_items", label: "اندازهٔ منو", get: () => undefined },
  { key: "hours_open", label: "ساعت کاری", get: () => undefined },
];

/** SPEC 2.6 -- the reason anyone plays, and the recruiting engine.
 *  Honesty rule: below twelve cafés, say so plainly. A percentile computed from a
 *  handful of cafés is not the market, and saying so is also the most persuasive
 *  possible argument for bringing a friend. */
export default function M06Reveal() {
  const screen = useRef<HTMLDivElement>(null);
  const s = useSession((st) => st.session)!;
  const patch = useSession((st) => st.patch);
  const goto = useSession((st) => st.goto);
  const step = s.cursor.step;
  const n = (B.n as number) ?? 0;
  const thin = n < 12;
  const [ref1, setRef1] = useState(s.close.referrals[0] ?? ""); const [ref2, setRef2] = useState(s.close.referrals[1] ?? "");

  useGSAP(() => {
    if (step !== 0) return;
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const timeline = gsap.timeline({ defaults: { ease: "power2.out" } });
      timeline.from(".bar", { autoAlpha: 0, y: 12, duration: .36, stagger: .07 })
        .from(".bar .you", { scaleY: 0, transformOrigin: "center bottom", duration: .42, stagger: .05 }, "<.12");
    });
    return () => mm.revert();
  }, { scope: screen, dependencies: [step], revertOnUpdate: true });

  if (step === 0) {
    return (
      <div ref={screen} className="screen reveal-screen">
        <SectionIntro kind="report" title="کارت کافهٔ تو" description="این خلاصه از پاسخ‌های خودت ساخته شده است. مقایسه با کافه‌های دیگر فقط وقتی نمایش داده می‌شود که دادهٔ واقعی برای آن داشته باشیم؛ بیشتر یا کمتر بودن هیچ‌کدام به معنی بهتر یا بدتر بودن نیست." step={COPY.revealTitle} />

        {thin && (
          <div className="notice">
            <strong>{n === 0 ? "هنوز دادهٔ مقایسه‌ای در این نسخه نیست." : `${fa(n)} کافه در مجموعهٔ مقایسه.`}</strong> {n > 0 ? COPY.revealThin : "فعلاً فقط اطلاعات کافهٔ خودت را می‌بینی."}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", flex: 1 }}>
          {BARS.map((b) => {
            const band = B[b.key] as Band | undefined;
            const you = b.key === "menu_items" ? s.observation.menu_items ?? undefined : b.key === "hours_open" ? s.observation.hours_open ?? undefined : b.get(s.profile as Record<string, unknown>);
            const hasBand = band && typeof band === "object" && "p50" in band;
            return (
              <div className="bar" key={b.key}>
                <div className="lab">
                  <span>{b.label}</span>
                  <span className="muted">{you === undefined ? "هنوز ثبت نشده" : `${fa(you)}${b.key === "price_ref" ? " تومان" : b.key === "hours_open" ? " ساعت" : ""}`}</span>
                </div>
                {hasBand && you !== undefined && <div className="track">
                  {hasBand && you !== undefined && (() => {
                    const lo = band!.p25, hi = band!.p75, span = Math.max(1, hi - lo);
                    const pct = Math.min(100, Math.max(0, ((you - lo) / span) * 50 + 25));
                    return <>
                      <span className="fill" style={{ width: "50%", insetInlineStart: "25%", opacity: .25 }} />
                      <span className="you" style={{ insetInlineStart: `calc(${pct}% - 2px)` }} />
                    </>;
                  })()}
                </div>}
                {you === undefined && <div className="helper">مصاحبه‌گر این مورد را در بخش مشاهده ثبت می‌کند.</div>}
                {hasBand && you !== undefined && <div className="helper">نوار سبز: نیمهٔ میانی کافه‌ها · نشان طلایی: موقعیت تقریبی شما</div>}
              </div>
            );
          })}
        </div>

        <div className="foot">
          <button className="btn primary" onClick={() => goto("reveal", 1)}>{COPY.next}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen">
      <Illustration kind="cafe" />
      <h2>ممنون که از کافه‌ات گفتی.</h2>
      <p className="helper">پاسخ‌هایت کمک می‌کند نیازهای کافه‌های رشت را بهتر بشناسیم. این دو سؤال پایانی اختیاری‌اند.</p>

      <div className="field">
        <label>کافهٔ دیگری می‌شناسی که مایل باشد شرکت کند؟</label>
        <p className="helper">نام کافه کافی است؛ نیازی به شمارهٔ تماس نیست.</p>
        <input aria-label="نام کافهٔ اول، اختیاری" placeholder="نام کافهٔ اول (اختیاری)" className="chip" style={{ width: "100%" }} value={ref1} onChange={(e) => setRef1(e.target.value)} />
        <input aria-label="نام کافهٔ دوم، اختیاری" placeholder="نام کافهٔ دوم (اختیاری)" className="chip" style={{ width: "100%" }} value={ref2} onChange={(e) => setRef2(e.target.value)} />
      </div>

      <div className="field">
        <label>حاضرید نسخهٔ آزمایشی را امتحان کنید؟</label>
        <div className="chips">
          {[{label:"بله، علاقه دارم",value:true},{label:"نه، فعلاً نه",value:false},{label:"هنوز تصمیم نگرفته‌ام",value:null}].map((v) =>
            <button key={v.label} className="chip" aria-pressed={s.close.pilot_willing === v.value}
                    onClick={() => patch((d) => { d.close.pilot_willing = v.value; })}>{v.label}</button>)}
        </div>
      </div>

      <div className="foot">
        <button className="btn primary" onClick={async () => {
          await patch((d) => { d.close.referrals = [ref1, ref2].filter((x) => x.trim()); });
          goto("done", 0);
        }}>پایان و تحویل تبلت</button>
      </div>
    </div>
  );
}
