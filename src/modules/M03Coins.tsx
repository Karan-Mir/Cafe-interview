import { useSession } from "../core/store";
import { COIN_JOBS, COPY } from "../content/items";
import { fa } from "../core/fa";
import { SectionIntro } from "../ui/Illustration";

const TOTAL = 10;

/** SPEC 2.3 -- ten coins across the five jobs. Measures intensity, which a
 *  ranking cannot. Must allocate exactly ten; never show a timer. */
export default function M03Coins() {
  const s = useSession((st) => st.session)!;
  const patch = useSession((st) => st.patch);
  const goto = useSession((st) => st.goto);
  const coins = s.coins;
  const used = COIN_JOBS.reduce((a, _, k) => a + (coins[`job_${k}`] ?? 0), 0);
  const left = TOTAL - used;

  const bump = (k: number, d: number) => {
    const cur = coins[`job_${k}`] ?? 0;
    const next = cur + d;
    if (next < 0 || (d > 0 && left <= 0)) return;
    patch((x) => { x.coins[`job_${k}`] = next; });
  };

  return (
    <div className="screen">
      <SectionIntro kind="coins" title="حل کدام کار برایت مهم‌تر است؟" description={COPY.coinsPrompt} step="اولویت‌های کافه" />

      <div className="tray" aria-label={COPY.coinsLeft}>
        {Array.from({ length: TOTAL }, (_, n) =>
          <span key={n} className={"dot" + (n < left ? " live" : "")} />)}
        <span className="small muted" style={{ marginInlineStart: ".5rem" }}>
          {fa(left)} {COPY.coinsLeft}
        </span>
      </div>

      <div className="jobs">
        {COIN_JOBS.map((name, k) => {
          const v = coins[`job_${k}`] ?? 0;
          return (
            <div className="jobrow coin-row" key={k}>
              <button className="btn ghost" style={{ minWidth: 56 }} disabled={v === 0} onClick={() => bump(k, -1)} aria-label={`کم کردن سکه از ${name}`}>−</button>
              <div className="dots" aria-hidden>
                {Array.from({ length: v }, (_, n) => <span key={n} className="dot" />)}
              </div>
              <div className="name">{name}</div>
              <span className="coin-count" aria-live="polite">{fa(v)} سکه</span>
              <button className="btn ghost" style={{ minWidth: 56 }} disabled={left === 0} onClick={() => bump(k, +1)} aria-label={`افزودن سکه به ${name}`}>+</button>
            </div>
          );
        })}
      </div>

      <div className="foot">
        <button className="btn primary" disabled={left !== 0} onClick={() => goto("cbc", 0)}>
          {left === 0 ? COPY.next : `${fa(left)} سکه مانده`}
        </button>
      </div>
    </div>
  );
}
