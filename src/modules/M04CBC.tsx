import { useEffect, useMemo, useRef, useState } from "react";
import { useSession, buildCbcTasks } from "../core/store";
import { ATTRIBUTES, PRICE_MULT, COPY } from "../content/items";
import { fa, priceToman } from "../core/fa";
import { Progress } from "../ui/bits";
import { SectionIntro } from "../ui/Illustration";

/**
 * SPEC 2.4 -- the core. 14 screens: 10 design + 2 holdout + 2 trap, in a shuffled
 * order OF THE FIXED SET. Card positions are shuffled per task to kill position
 * bias, and `profiles` is recorded in the order shown so `chosen` indexes it.
 *
 * [STATS] Everything on this screen except the ordering comes from the design
 * file. Nothing here generates a profile.
 */
export default function M04CBC() {
  const s = useSession((st) => st.session)!;
  const goto = useSession((st) => st.goto);
  const record = useSession((st) => st.recordCbc);

  const tasks = useMemo(() => buildCbcTasks(s.session_id), [s.session_id]);
  const i = s.cursor.step;
  const task = tasks[i];
  const refToman = s.profile.price_ref_toman ?? 0;
  const refItem = s.profile.price_ref_item ?? "قهوه";

  const [chosen, setChosen] = useState<number | null>(null);
  const t0 = useRef(performance.now());
  const [saving, setSaving] = useState(false);
  const firstTap = useRef<number | null>(null);
  const buyPanel = useRef<HTMLDivElement>(null);

  useEffect(() => { setChosen(null); firstTap.current = null; t0.current = performance.now(); }, [i]);
  useEffect(() => { if (chosen !== null) buyPanel.current?.scrollIntoView({ block: "nearest", behavior: "auto" }); }, [chosen]);

  const select = (k: number) => {
    if (firstTap.current === null) firstTap.current = Math.round(performance.now() - t0.current);
    setChosen(k);
  };

  const answer = async (buy: boolean) => {
    if (chosen === null || saving) return;
    setSaving(true);
    try {
    await record(
      {
        task: task.task, kind: task.kind, position: i,
        profiles: task.profiles, chosen,
        would_buy: buy,
        latency_ms: firstTap.current ?? Math.round(performance.now() - t0.current),
      },
      task.dominated,
    );
    if (i + 1 < tasks.length) await goto("cbc", i + 1); else await goto("voice", 0);
    } finally { setSaving(false); }
  };

  return (
    <div className="screen cbc-screen">
      <Progress n={i + 1} of={tasks.length} />
      <SectionIntro kind="choices" title={COPY.cbcPrompt} description="هر بسته را با همهٔ ویژگی‌ها و قیمت ماهانه‌اش بسنج. ابتدا مناسب‌ترین را انتخاب کن؛ سپس بگو آیا واقعاً آن را می‌خریدی. انتخاب اینجا هیچ تعهد خریدی ایجاد نمی‌کند." step={`مقایسهٔ بسته‌ها · ${fa(i + 1)} از ${fa(tasks.length)}`} />

      <div className="packs" aria-label="سه بسته برای مقایسه">
        {task.profiles.map((prof, k) => (
          <button key={k} type="button" className="pack" aria-pressed={chosen === k}
                  disabled={saving} onClick={() => select(k)}>
            <span className="pack-title">بستهٔ {fa(k + 1)} <span>{chosen === k ? "✓ انتخاب شما" : "برای انتخاب بزن"}</span></span>
            <span className="package-object" aria-hidden="true"><i /><i /><i /></span>
            {ATTRIBUTES.slice(0, 5).map((a, ai) => (
              <div className="row" key={a.id}>
                <span className="ic" aria-hidden>{a.icon}</span>
                <span><span className="attribute-label">{a.label}</span>{a.levels[prof[ai]]}</span>
              </div>
            ))}
            <div className="price">
              <span className="attribute-label">هزینهٔ ماهانهٔ این بسته</span>
              <div className="big">{fa(priceToman(PRICE_MULT[prof[5]], refToman))} تومان</div>
              <div className="sub">
                به اندازهٔ {fa(PRICE_MULT[prof[5]])} تا {refItem} {COPY.perMonth}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="comparison-matrix" role="group" aria-label="مقایسهٔ سه بسته">
        <div className="matrix-corner" aria-hidden="true">ویژگی</div>
        {task.profiles.map((_, k) => <div className="matrix-heading" key={`head-${k}`}>بستهٔ {fa(k + 1)}</div>)}
        {ATTRIBUTES.slice(0, 5).map((a, ai) => <div className="matrix-row" key={a.id}>
          <div className="matrix-label"><span aria-hidden>{a.icon}</span>{a.label}</div>
          {task.profiles.map((prof, k) => <div className="matrix-value" key={`${a.id}-${k}`}>{a.levels[prof[ai]]}</div>)}
        </div>)}
        <div className="matrix-row matrix-price-row">
          <div className="matrix-label">هزینهٔ ماهانه</div>
          {task.profiles.map((prof, k) => <div className="matrix-value" key={`price-${k}`}>
            <strong>{fa(priceToman(PRICE_MULT[prof[5]], refToman))}</strong>
            <small>تومان · {fa(PRICE_MULT[prof[5]])} {refItem}</small>
          </div>)}
        </div>
        <div className="matrix-row matrix-action-row">
          <div className="matrix-label">انتخاب</div>
          {task.profiles.map((_, k) => <button key={`pick-${k}`} className="matrix-pick" type="button"
            aria-pressed={chosen === k} disabled={saving} onClick={() => select(k)}>
            {chosen === k ? "✓ انتخاب شد" : `بستهٔ ${fa(k + 1)}`}
          </button>)}
        </div>
      </div>

      {/* SPEC 2.4 dual-response none -- yields far more than a third "none" card,
          and is what makes a credible take-rate estimate possible. */}
      {chosen !== null && (
        <div ref={buyPanel} className="notice ok buy-panel" style={{ display: "flex", flexWrap: "wrap",
                                            alignItems: "center", gap: ".75rem" }}>
          <span style={{ flex: 1, minWidth: "14rem" }}>{COPY.cbcBuy}</span>
          <button className="btn primary" style={{ flex: "none", minWidth: 110 }}
                  disabled={saving} onClick={() => answer(true)}>{COPY.cbcYes}</button>
          <button className="btn ghost" style={{ flex: "none", minWidth: 110 }}
                  disabled={saving} onClick={() => answer(false)}>{COPY.cbcNo}</button>
        </div>
      )}

      <div className="foot">
        {i > 0 && <button className="btn ghost" onClick={() => goto("cbc", i - 1)}>{COPY.back}</button>}
      </div>
    </div>
  );
}
