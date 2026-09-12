import { useEffect, useRef, useState } from "react";
import { useSession, buildMaxdiffSets } from "../core/store";
import { MAXDIFF_ITEMS, COPY } from "../content/items";
import { Progress } from "../ui/bits";
import { SectionIntro } from "../ui/Illustration";
import { fa } from "../core/fa";

/** Twelve fixed sets; explicit best/worst controls allow reviewing both choices
 * before advancing. The design composition and stored answer shape are unchanged. */
export default function M02MaxDiff() {
  const s = useSession((st) => st.session)!;
  const goto = useSession((st) => st.goto);
  const record = useSession((st) => st.recordMaxdiff);
  const sets = buildMaxdiffSets(s.session_id);
  const i = s.cursor.step;
  const items = sets[i];

  const saved = s.maxdiff.responses.find((r) => r.set === i);
  const [best, setBest] = useState<number | null>(saved?.best ?? null);
  const [worst, setWorst] = useState<number | null>(saved?.worst ?? null);
  const t0 = useRef(performance.now());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const prev = s.maxdiff.responses.find((r) => r.set === i);
    setBest(prev?.best ?? null); setWorst(prev?.worst ?? null);
    t0.current = performance.now();
  }, [i]);

  const advance = async () => {
    if (best === null || worst === null || saving) return;
    setSaving(true);
    try {
      await record({ set: i, items, best, worst, latency_ms: Math.round(performance.now() - t0.current) });
      if (i + 1 < sets.length) await goto("maxdiff", i + 1); else await goto("coins", 0);
    } finally { setSaving(false); }
  };

  return (
    <div className="screen">
      <Progress n={i + 1} of={sets.length} />
      <SectionIntro kind="choices" title="کدام ایده بیشتر به کارت می‌آید؟" description={COPY.maxdiffHelp} step={`مقایسهٔ ایده‌ها · ${fa(i + 1)} از ${fa(sets.length)}`} />

      <div className="grid2">
        {items.map((it) => {
          const pick = best === it ? "best" : worst === it ? "worst" : undefined;
          return (
            <div key={it} className="mdcard" data-pick={pick}>
              <div className="t">{MAXDIFF_ITEMS[it].title}</div>
              <div className="l">{MAXDIFF_ITEMS[it].line}</div>
              <div className="choice-actions">
                <button className="choice-toggle" aria-pressed={best === it} disabled={saving} onClick={() => { setBest(best === it ? null : it); if (worst === it) setWorst(null); }} aria-label={`${MAXDIFF_ITEMS[it].title}: ${COPY.maxdiffBest}`}>＋ {COPY.maxdiffBest}</button>
                <button className="choice-toggle" aria-pressed={worst === it} disabled={saving} onClick={() => { setWorst(worst === it ? null : it); if (best === it) setBest(null); }} aria-label={`${MAXDIFF_ITEMS[it].title}: ${COPY.maxdiffWorst}`}>− {COPY.maxdiffWorst}</button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="foot">
        {i > 0 && <button className="btn ghost" onClick={() => goto("maxdiff", i - 1)}>{COPY.back}</button>}
        <button className="btn primary" disabled={best === null || worst === null || saving} onClick={advance}>{saving ? "در حال ذخیره…" : COPY.next}</button>
      </div>
    </div>
  );
}
