# -*- coding: utf-8 -*-
"""Plant known preferences, simulate 90 sessions, check the pipeline recovers them.

This is the acceptance test for the analysis code. If recovery fails here it
will fail on real data, and nobody will notice because real data has no answer key.
"""
import json, uuid, math, random
from pathlib import Path
import numpy as np

import analyse as A

RNG = np.random.default_rng(7)
random.seed(7)
HERE = Path(__file__).parent
SESS = HERE.parent / "sessions"
SESS.mkdir(exist_ok=True)
for f in SESS.glob("*.json"):
    f.unlink()

md_design = json.loads((HERE.parent / "design/maxdiff_design.json").read_text(encoding="utf-8"))
cbc_design = json.loads((HERE.parent / "design/cbc_design.json").read_text(encoding="utf-8"))

# ── the answer key ───────────────────────────────────────────────────────
# CBC: effects-coded true utilities, one block per attribute.
TRUE = {
    "job":      [0.9, 0.2, -0.4, -0.3, -0.4, 0.1],  # pricing/margin wins;
                                                # [5] customer analysis, mild
    "input":    [0.8, 0.5, -0.9, -0.4],         # automatic in, manual daily hated
    "delivery": [-0.5, 0.2, 0.3, 0.0],          # paper worst; app best; assistant middling
    "who":      [-0.3, 0.6, -0.3],              # automatic but supervised
    "commit":   [0.5, 0.0, -0.5],               # dislikes lock-in
    "price":    [1.0, 0.5, -0.2, -0.5, -0.8],   # monotone decreasing
}
for k in TRUE:                                   # effects coding: levels sum to zero
    v = np.array(TRUE[k], dtype=float)
    TRUE[k] = list(v - v.mean())

TRUE_BUY_INTERCEPT = -0.6          # planted base rate for the dual-response none

TRUE_MD = np.array([0.3, 1.4, 1.1, -0.2, 0.4, -0.5, 0.9, -0.3,
                    -0.6, 0.8, -0.9, 0.5, -1.1, 0.2, 0.6])     # 15 items
TRUE_MD = TRUE_MD - TRUE_MD.mean()


def true_beta_vector():
    out = []
    for name, n in A.ATTRS:
        out.extend(TRUE[name][:n - 1])           # first n-1, last is implied
    return np.array(out)


def utility(profile):
    return sum(TRUE[name][lvl] for (name, _n), lvl in zip(A.ATTRS, profile))


# ── simulate ─────────────────────────────────────────────────────────────
def dominated_index(task):
    """Index of the strictly dominated alternative, or None."""
    for x in range(len(task)):
        for y in range(len(task)):
            if x == y:
                continue
            a, b = task[x], task[y]
            if a[:4] == b[:4] and a[4] <= b[4] and a[5] <= b[5] and (a[4] < b[4] or a[5] < b[5]):
                return y
    return None


N = 90
# A careless respondent CLICKS AT RANDOM -- on every task, not just the traps.
# The earlier version planted them as deterministically choosing the dominated
# alternative, which is the single most detectable behaviour possible and made the
# trap look 100% sensitive. One dominance trap catches a random clicker 1 time in 3.
PLANTED_CARELESS: set[str] = set()
ACTUALLY_CHOSE_DOMINATED: set[str] = set()
for i in range(N):
    sid = str(uuid.uuid4())
    mdv = i % md_design["meta"]["versions"]
    cbv = i % cbc_design["meta"]["versions"]
    # respondent-level noise, so this is not a single homogeneous taste
    jitter = {k: np.array(v) + RNG.normal(0, 0.25, len(v)) for k, v in TRUE.items()}

    md_resp = []
    for s_i, items in enumerate(md_design["versions"][mdv]):
        u = TRUE_MD[items] + RNG.normal(0, 0.4, len(items))
        md_resp.append({"set": s_i, "items": items,
                        "best": int(items[int(np.argmax(u))]),
                        "worst": int(items[int(np.argmin(u))]),
                        "latency_ms": int(RNG.normal(3800, 900))})

    def choose(profiles):
        u = np.array([sum(jitter[name][lvl] for (name, _n), lvl in zip(A.ATTRS, p))
                      for p in profiles])
        u = u + RNG.gumbel(0, 1, len(u))         # logit error
        return int(np.argmax(u))

    def buys(profile):
        """Planted take-rate: buying depends on the package's utility, not a coin
        flip. TRUE_BUY_INTERCEPT sets the base rate."""
        u = sum(jitter[name][lvl] for (name, _n), lvl in zip(A.ATTRS, profile))
        return bool(RNG.random() < 1.0 / (1.0 + math.exp(-(TRUE_BUY_INTERCEPT + u))))

    careless = (i % 7 == 3)                      # 13 of 90 click at random
    if careless:
        PLANTED_CARELESS.add(f"s{i:03d}.json")

    def respond(task):
        return int(RNG.integers(len(task))) if careless else choose(task)

    cbc_resp = []
    for t, task in enumerate(cbc_design["versions"][cbv]):
        ch = respond(task)
        cbc_resp.append({"task": t, "kind": "design", "position": t,
                         "profiles": task, "chosen": ch,
                         "would_buy": buys(task[ch]),
                         "latency_ms": int(RNG.normal(1300, 400) if careless
                                           else RNG.normal(5200, 1400))})
    for h, task in enumerate(cbc_design["holdouts"]):
        chh = respond(task)
        cbc_resp.append({"task": 100 + h, "kind": "holdout", "position": 10 + h,
                         "profiles": task, "chosen": chh,
                         "would_buy": buys(task[chh]),
                         "latency_ms": int(RNG.normal(5200, 1400))})
    trap_failed = False
    for ti, trap in enumerate(cbc_design["traps"]):
        tch = respond(trap)
        # [STATS] Detect by comparing the CHOSEN PROFILE to the dominated one -- never
        # by index. The app shuffles card positions within a task, so the dominated
        # alternative is not at a fixed index and an index test silently stops working.
        if tch == dominated_index(trap):
            trap_failed = True
            ACTUALLY_CHOSE_DOMINATED.add(f"s{i:03d}.json")
        cbc_resp.append({"task": 200 + ti, "kind": "trap", "position": 12 + ti,
                         "profiles": trap, "chosen": tch, "would_buy": False,
                         "latency_ms": int(RNG.normal(5000, 1200))})

    lat = [r["latency_ms"] for r in cbc_resp]
    fast_tasks = sum(1 for r in cbc_resp if r["kind"] == "design" and r["latency_ms"] < 2000)
    json.dump({
        "schema": 1, "session_id": sid, "design_version": "2026-09-12",
        "started_at": "2026-09-20T10:00:00Z", "finished_at": "2026-09-20T10:10:00Z",
        "interviewer": "KM", "device": "tab-01",
        "consent": {"analysis": True, "named": False},
        "profile": {"years": int(RNG.integers(1, 12)), "branches": "یک",
                    "staff_ft": int(RNG.integers(1, 5)), "staff_pt": int(RNG.integers(0, 4)),
                    "shifts": "دو", "type": "قهوه‌محور",
                    "seats": int(RNG.normal(28, 9)), "pos": "صندوق ساده",
                    # The interviewer reads this off the menu before handing the
                    # tablet over. The owner is never asked. PLACEHOLDER value only.
                    "price_ref_item": "espresso", "price_ref_toman": 95000},
        "price_mult": [3.0, 6.0, 10.0, 16.0, 25.0],
        "maxdiff": {"version": mdv, "responses": md_resp},
        # 12 coins over SIX job areas (SPEC 2.3) -- must track ATTRS["job"]
        "coins": {f"job_{k}": int(v) for k, v in
                  enumerate(RNG.multinomial(12, [.35, .18, .09, .17, .09, .12]))},
        "cbc": {"version": cbv, "responses": cbc_resp},
        "open": {"audio_ref": None, "duration_s": 0, "text": None},
        "close": {"referrals": [], "allow_pos_data": "نه", "pilot_willing": True},
        "observation": {"seats": int(RNG.normal(28, 9)),
                        "price_espresso": int(RNG.normal(95000, 18000)),
                        "menu_items": int(RNG.normal(30, 9)),
                        "hours_open": round(float(RNG.normal(12, 2)), 1),
                        "competitors_2min": int(RNG.integers(0, 8)),
                        "order_taking": "روی کاغذ نوشت"},
        "quality": {"median_latency_ms": int(np.median(lat)),
                    "fast_tasks": fast_tasks,
                    "trap_failed": trap_failed,
                    "straightlined": False, "holdout_consistent": None,
                    "completed": True},
    }, open(SESS / f"s{i:03d}.json", "w", encoding="utf-8"), ensure_ascii=False)

print(f"simulated {N} sessions\n")

# ── run the real pipeline ────────────────────────────────────────────────
import os
os.chdir(HERE)
A.main([str(SESS / "*.json")])

# ── compare against the answer key ───────────────────────────────────────
import pandas as pd
util = pd.read_csv("cbc_utilities.csv")
true_long = []
for name, n in A.ATTRS:
    for lvl in range(n):
        true_long.append({"attribute": name, "level": lvl, "true": TRUE[name][lvl]})
cmp = util.merge(pd.DataFrame(true_long), on=["attribute", "level"])
r = np.corrcoef(cmp.utility, cmp["true"])[0, 1]
mae = float(np.abs(cmp.utility - cmp["true"]).mean())

print("\n── recovery of planted CBC utilities ─────────────────")
print(f"  correlation true vs estimated : {r:.3f}")
print(f"  mean absolute error           : {mae:.3f}")
print(f"  sign agreement                : "
      f"{(np.sign(cmp.utility) == np.sign(cmp['true'])).mean():.0%}")
worst = cmp.reindex((cmp.utility - cmp["true"]).abs().sort_values(ascending=False).index).head(3)
print("  largest misses:")
for _, w in worst.iterrows():
    print(f"    {w.attribute:9s} level {int(w.level)}  true {w['true']:+.2f}  est {w.utility:+.2f}")

md = pd.read_csv("maxdiff_scores.csv").sort_values("item")
r_md = np.corrcoef(md.bw_score, TRUE_MD)[0, 1]
top3_true = set(np.argsort(-TRUE_MD)[:3])
top3_est = set(pd.read_csv("maxdiff_scores.csv").head(3)["item"])
print("\n── recovery of planted MaxDiff preferences ───────────")
print(f"  correlation true vs B-W score : {r_md:.3f}")
print(f"  top-3 items recovered         : {len(top3_true & top3_est)}/3  "
      f"(true {sorted(top3_true)}, est {sorted(top3_est)})")

# ── willingness to pay, against the planted truth ────────────────────────
# Ground truth uses the SAME estimator path, so this isolates recovery error
# rather than re-testing the formula against itself.
true_util = pd.DataFrame([{"attribute": n, "level": l, "utility": TRUE[n][l], "se": np.nan}
                          for n, nl in A.ATTRS for l in range(nl)])
true_wtp = A.willingness_to_pay(true_util).set_index(["attribute", "level"]).wtp_units
est_wtp = pd.read_csv("wtp.csv").set_index(["attribute", "level"]).wtp_units
j = pd.concat([true_wtp.rename("true"), est_wtp.rename("est")], axis=1).dropna()
# Score WTP in absolute shifts, not percent: WTP legitimately crosses zero
# (the reference level is exactly 0), so a percentage error is unbounded noise.
# Score only levels that fall INSIDE the tested price ladder -- an estimator
# cannot be held to account for a range the design never measured.
est_full = pd.read_csv("wtp.csv").set_index(["attribute", "level"])
true_full = A.willingness_to_pay(true_util).set_index(["attribute", "level"])
measurable = ~(est_full.extrapolated | true_full.extrapolated)
jm = j[measurable.reindex(j.index).fillna(False)]
wtp_err = float((jm.est - jm["true"]).abs().mean())
wtp_corr = float(np.corrcoef(jm.est, jm["true"])[0, 1])
n_extrap = int(est_full.extrapolated.sum())
pct_extrap = n_extrap / len(est_full) * 100

print()
print("── willingness to pay, in coffees per month ─────────────")
print(f"  reference levels: {A.REFERENCE}")
print(f"  levels inside the tested ladder : {len(jm)}/{len(est_full)}")
_span = max(A.PRICE_MULT) - min(A.PRICE_MULT)
print(f"  mean abs error (measurable only) : {wtp_err:.3f} coffees/month "
      f"({wtp_err/_span:.1%} of the x{min(A.PRICE_MULT):g}-x{max(A.PRICE_MULT):g} span)")
print(f"  correlation (measurable only)    : {wtp_corr:.3f}")
_top = max(A.PRICE_MULT)
print(f"  levels pricing out beyond x{_top:g}     : {n_extrap} ({pct_extrap:.0f}%)"
      + ("  -> ladder too narrow" if pct_extrap > 25 else ""))
for a in ["job", "input", "delivery", "who", "commit"]:
    sub = est_wtp.loc[a].dropna()
    if len(sub):
        print(f"  {a:9s} ref lvl {A.REFERENCE[a]} | best {sub.max():+.2f} (lvl "
              f"{int(sub.idxmax())}) | worst {sub.min():+.2f} (lvl {int(sub.idxmin())}) "
              f"| spread {sub.max()-sub.min():.2f} coffees/mo")

imp = pd.read_csv("attribute_importance.csv")
print()
print("── attribute importance (baseline-free) ──────────────")
for _, row in imp.iterrows():
    print(f"  {row.attribute:9s} {row.importance_pct:5.1f}%")

# ── holdouts, trap, take-rate ────────────────────────────────────────────
sessions_all = A.load([str(SESS / "*.json")])
kept = [x for x in sessions_all if A.usable(x)[0]]
Xh, yh = A.collect_cbc(kept, kinds=("holdout",))
beta_fit, _, _ = A.fit_clogit(*A.collect_cbc(kept, kinds=("design",)))
hit = float(((Xh @ beta_fit).argmax(axis=1) == yh).mean()) if len(yh) else float("nan")

flagged = {Path(x["_file"]).name for x in sessions_all if x.get("quality", {}).get("trap_failed")}
caught = len(flagged & PLANTED_CARELESS)
detect_rate = caught / len(PLANTED_CARELESS) if PLANTED_CARELESS else float("nan")
mechanism_ok = flagged == ACTUALLY_CHOSE_DOMINATED
false_pos = len(flagged - PLANTED_CARELESS)
# What matters is false positives in the EXCLUSION decision, not in the raw trap
# flag. A careful respondent tripping a dominance trap now and then is expected
# behaviour, not a defect -- it is exactly why the trap needs corroboration.
excluded_names = {Path(x["_file"]).name for x in sessions_all if not A.usable(x)[0]}
wrongly_excluded = excluded_names - PLANTED_CARELESS
missed_careless = PLANTED_CARELESS - excluded_names

tr_df, tr_raw = A.take_rate(kept)
chosen_profiles = [resp["profiles"][resp["chosen"]]
                   for sess in kept
                   for resp in sess.get("cbc", {}).get("responses", [])
                   if resp.get("kind") == "design"]
true_rate = float(np.mean([1 / (1 + math.exp(-(TRUE_BUY_INTERCEPT
              + sum(TRUE[n][p[k]] for k, (n, _) in enumerate(A.ATTRS)))))
              for p in chosen_profiles]))

print()
print("── validation checks ─────────────────────────────────")
print(f"  holdout hit rate              : {hit:.1%}  (chance = 33.3%)")
print(f"  trap: planted random-clickers : {len(PLANTED_CARELESS)}")
print(f"  trap: caught                  : {caught}/{len(PLANTED_CARELESS)} "
      f"({detect_rate:.0%})   2 traps, theory says 56%")
print(f"  trap: flags exactly those who chose a dominated alt : {mechanism_ok}")
print(f"  trap: false positives (raw flag): {false_pos}  -- expected, see usable()")
print(f"  screen: careless excluded     : "
      f"{len(PLANTED_CARELESS) - len(missed_careless)}/{len(PLANTED_CARELESS)}")
print(f"  screen: careful wrongly dropped: {len(wrongly_excluded)}")
print(f"  take-rate, observed           : {tr_raw:.1%}")
print(f"  take-rate, planted (design avg): {true_rate:.1%}")

coins = pd.read_csv("coins.csv")
print(f"  coins module analysed         : yes, {len(coins)} jobs summarised")

bm = json.loads(Path("benchmarks.json").read_text(encoding="utf-8"))
print(f"  benchmark fields missing      : {bm['missing_fields'] or 'none'}")

# ── heterogeneity: how far do aggregate utilities shrink? ────────────────
print()
print("── shrinkage under respondent heterogeneity ──────────")
print("  (aggregate conditional logit shrinks toward zero when tastes differ)")
true_vec = np.array([TRUE[n][l] for n, nl in A.ATTRS for l in range(nl)])


def sweep(sd, n=90, reps=6, seed0=9000):
    sl, co = [], []
    for rep in range(reps):
        R = np.random.default_rng(seed0 + rep)
        Xs, ys = [], []
        for i in range(n):
            cbv = i % cbc_design["meta"]["versions"]
            jit = {k: np.array(v) + R.normal(0, sd, len(v)) for k, v in TRUE.items()}
            for task in cbc_design["versions"][cbv]:
                u = np.array([sum(jit[nm][p[k]] for k, (nm, _) in enumerate(A.ATTRS))
                              for p in task]) + R.gumbel(0, 1, 3)
                Xs.append(np.stack([A.effects_row(p) for p in task]))
                ys.append(int(np.argmax(u)))
        b, se, _ = A.fit_clogit(np.stack(Xs), np.array(ys))
        e = A.label_betas(b, se).sort_values(["attribute", "level"])
        order = [(n_, l) for n_, nl in A.ATTRS for l in range(nl)]
        est = np.array([float(e[(e.attribute == a) & (e.level == l)].utility.iloc[0])
                        for a, l in order])
        tv = np.array([TRUE[a][l] for a, l in order])
        sl.append(np.polyfit(tv, est, 1)[0])
        co.append(np.corrcoef(tv, est)[0, 1])
    return float(np.mean(sl)), float(np.mean(co))


print(f"  {'sd':>5} | {'slope':>6} | {'corr':>6} | reading")
labels = {0.0: "identical owners", 0.25: "moderate", 0.5: "high", 0.75: "very high"}
shrink = {}
for sd in [0.0, 0.25, 0.5, 0.75]:
    sl, co = sweep(sd)
    shrink[sd] = sl
    print(f"  {sd:>5.2f} | {sl:>6.3f} | {co:>6.3f} | {labels[sd]}")
print("  -> the ORDER is trustworthy at every level; the MAGNITUDES are")
print("     conservative, and increasingly so as owners differ.")

# ── acceptance ───────────────────────────────────────────────────────────
checks = {
    "CBC utility correlation > 0.90":        r > 0.90,
    "MaxDiff correlation > 0.90":            r_md > 0.90,
    "MaxDiff top-3 recovered >= 2":          len(top3_true & top3_est) >= 2,
    "holdout hit rate > 0.50":               hit > 0.50,
    "trap flags exactly the dominated-choosers": mechanism_ok,
    "quality screen wrongly drops <=3%":     len(wrongly_excluded) <= 0.03 * (N - len(PLANTED_CARELESS)),
    "quality screen catches >=80% careless": len(missed_careless) <= 0.2 * len(PLANTED_CARELESS),
    "trap detection in theory range (2 traps)": 0.30 <= detect_rate <= 0.85,
    "WTP error < 10% of the price span":     wtp_err < 0.10 * (max(A.PRICE_MULT) - min(A.PRICE_MULT)),
    "price ladder covers >75% of levels":    pct_extrap <= 25,
    "WTP correlation with truth > 0.90":     wtp_corr > 0.90,
    "take-rate within 10pp of planted":      abs(tr_raw - true_rate) < 0.10,
    "no benchmark fields missing":           not bm["missing_fields"],
    "price curve monotone decreasing":       bool(pd.read_csv("wtp.csv").price_curve_monotone.iloc[0]),
    "shrinkage at identical owners ~1":      0.90 < shrink[0.0] < 1.15,
}
print()
print("── acceptance ────────────────────────────────────────")
for k, v in checks.items():
    print(f"  [{'PASS' if v else 'FAIL'}] {k}")
print()
print("ACCEPTANCE:", "PASS" if all(checks.values()) else "FAIL")
