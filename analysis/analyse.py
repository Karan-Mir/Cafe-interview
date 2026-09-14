# -*- coding: utf-8 -*-
"""Analysis companion for the قهوه‌سنج fieldwork.

    python analyse.py ../sessions/*.json

Reads exported session files and produces:

  maxdiff_scores.csv    counting scores per item, plus rank-ordered logit utilities
  cbc_utilities.csv     effects-coded part-worths from a conditional logit
  wtp.csv               willingness to pay per level, in reference items/month
  benchmarks.json       percentiles that feed the app's reveal screen
  quality_report.txt    exclusions, holdout hit rate, trap failures

Deliberately dependency-light: numpy and pandas only. The conditional logit is
fitted here rather than pulled from a package so the likelihood is inspectable.
"""
from __future__ import annotations
import json, sys, glob, math
from pathlib import Path
import numpy as np
import pandas as pd

# must mirror SPEC.md §3.6 and design/cbc_design.json
ATTRS = [("job", 6), ("input", 4), ("delivery", 4), ("who", 3), ("commit", 3), ("price", 5)]
PRICE_MULT = [3.0, 6.0, 10.0, 16.0, 25.0]       # multiples of the reference item
PRICE_UNIT = "coffees"                          # ... per month. See SPEC 3.6.6.

# WTP is reported as the change from a FIXED, declared reference level, never
# from "whichever level estimated lowest" — that baseline flips between runs
# whenever two levels are close, and every WTP in the attribute moves with it.
# Reference = the LEAST ATTRACTIVE version we would actually ship, declared a
# priori on business grounds, never fitted to the data:
#   job 4      benchmark comparison only, still the thinnest of the six
#   input 2    five minutes of manual entry a day, the most owner effort
#   delivery 0 a monthly paper sheet, the lowest tech and least timely
#   who 0      it decides and tells you -- least control, most trust demanded
#   commit 2   a one-year lock-in, plainly the worst term for the owner
# Every WTP then reads "this level is worth +N coffees/month more than that one",
# which is the direction the commercial question is actually asked in.
REFERENCE = {"job": 4, "input": 2, "delivery": 0, "who": 0, "commit": 2}

# Anchored at the cheapest rung. REFERENCE names the least attractive level of each
# attribute, so almost every delta is positive -- "how much MORE is this worth" --
# and those need headroom toward the expensive end of the ladder, which anchoring
# low maximises. The rare negative delta is extrapolated and flagged, not dropped.
PRICE_ANCHOR = 3.0
N_ITEMS = 15
LEVELS = [n for _, n in ATTRS]
K = sum(n - 1 for n in LEVELS)


# ────────────────────────────────────────────────────────────────── loading
def load(paths: list[str]) -> list[dict]:
    out = []
    for p in paths:
        for f in sorted(glob.glob(p)):
            d = json.loads(Path(f).read_text(encoding="utf-8"))
            d["_file"] = f
            out.append(d)
    return out


def usable(s: dict) -> tuple[bool, str]:
    """Exclusion rules from SPEC 6. Report every drop; never silently delete.

    A failed trap is NOT on its own grounds for exclusion. Measured on this design,
    two dominance traps catch ~60% of respondents who click at random, but also
    flag ~12% of careful ones -- a careful respondent's logit noise occasionally
    picks the dominated option. At a realistic 5% carelessness rate that means
    discarding roughly nine good cafes to remove two bad ones, which is a losing
    trade when a café costs an hour of fieldwork and cannot be asked twice.

    So the trap only excludes when speed corroborates it. Speed alone still does,
    because nobody reads three packages of six attributes in under two seconds.
    """
    q = s.get("quality", {})
    fast = q.get("fast_tasks", 0)
    if not s.get("consent", {}).get("analysis", True):
        return False, "consent withheld"
    if not q.get("completed"):
        return False, "incomplete"
    if q.get("straightlined"):
        return False, "straight-lined"
    if fast >= 5:
        return False, f"speeding ({fast} tasks under 2s)"
    if q.get("trap_failed") and fast >= 2:
        return False, f"failed trap AND {fast} tasks under 2s"
    return True, ""


def trap_only_flags(sessions: list[dict]) -> list[str]:
    """Failed the trap but was not fast -- kept, but worth an eyeball."""
    return [Path(s["_file"]).name for s in sessions
            if s.get("quality", {}).get("trap_failed")
            and s.get("quality", {}).get("fast_tasks", 0) < 2]


# ───────────────────────────────────────────────────────────────── MaxDiff
def maxdiff_counts(sessions: list[dict]) -> pd.DataFrame:
    shown = np.zeros(N_ITEMS)
    best = np.zeros(N_ITEMS)
    worst = np.zeros(N_ITEMS)
    for s in sessions:
        for r in s.get("maxdiff", {}).get("responses", []):
            for i in r["items"]:
                shown[i] += 1
            if r.get("best") is not None:
                best[r["best"]] += 1
            if r.get("worst") is not None:
                worst[r["worst"]] += 1
    with np.errstate(invalid="ignore", divide="ignore"):
        score = np.where(shown > 0, (best - worst) / shown, np.nan)
    df = pd.DataFrame({"item": range(N_ITEMS), "shown": shown.astype(int),
                       "best": best.astype(int), "worst": worst.astype(int),
                       "bw_score": score})
    # probability-scaled score, the form that is comparable across studies
    df["prob_scale"] = np.exp(df["bw_score"]) / np.exp(df["bw_score"]).sum() * 100
    return df.sort_values("bw_score", ascending=False).reset_index(drop=True)


def maxdiff_logit(sessions: list[dict], iters: int = 300) -> np.ndarray:
    """Rank-ordered logit: best chosen from the set, worst from the remainder."""
    sets = []
    for s in sessions:
        for r in s.get("maxdiff", {}).get("responses", []):
            b, w = r.get("best"), r.get("worst")
            if b is None or w is None:
                continue
            sets.append((list(r["items"]), b, w))
    if not sets:
        return np.zeros(N_ITEMS)
    beta = np.zeros(N_ITEMS)

    def nll_grad(beta):
        nll, g = 0.0, np.zeros(N_ITEMS)
        for items, b, w in sets:
            u = beta[items]
            p = np.exp(u - u.max()); p /= p.sum()
            nll -= math.log(max(p[items.index(b)], 1e-300))
            for j, it in enumerate(items):
                g[it] += p[j]
            g[b] -= 1.0
            rest = [i for i in items if i != b]
            u2 = -beta[rest]
            p2 = np.exp(u2 - u2.max()); p2 /= p2.sum()
            nll -= math.log(max(p2[rest.index(w)], 1e-300))
            for j, it in enumerate(rest):
                g[it] -= p2[j]
            g[w] += 1.0
        return nll, g

    step = 0.02
    for _ in range(iters):
        _, g = nll_grad(beta)
        beta -= step * g / max(len(sets), 1)
        beta -= beta.mean()                      # identify by zero-centring
    return beta


# ───────────────────────────────────────────────────────────────────── CBC
def effects_row(profile: list[int]) -> np.ndarray:
    row: list[float] = []
    for lvl, n in zip(profile, LEVELS):
        v = [0.0] * (n - 1)
        if lvl < n - 1:
            v[lvl] = 1.0
        else:
            v = [-1.0] * (n - 1)
        row.extend(v)
    return np.array(row)


def collect_cbc(sessions: list[dict], kinds=("design",)):
    X, y = [], []
    for s in sessions:
        for r in s.get("cbc", {}).get("responses", []):
            if r.get("kind") not in kinds:
                continue
            X.append(np.stack([effects_row(p) for p in r["profiles"]]))
            y.append(r["chosen"])
    return (np.stack(X), np.array(y)) if X else (np.zeros((0, 3, K)), np.array([]))


def fit_clogit(X: np.ndarray, y: np.ndarray, iters: int = 400, lr: float = 0.5):
    """Newton-free conditional logit by gradient ascent on the log-likelihood."""
    beta = np.zeros(K)
    n = len(y)
    if n == 0:
        return beta, np.full(K, np.nan), np.nan
    for _ in range(iters):
        V = X @ beta                                      # (n, alts)
        V -= V.max(axis=1, keepdims=True)
        P = np.exp(V); P /= P.sum(axis=1, keepdims=True)
        chosen = X[np.arange(n), y]                       # (n, K)
        grad = (chosen - np.einsum("na,nak->nk", P, X)).sum(axis=0)
        beta += lr * grad / n
    # observed information for standard errors
    V = X @ beta
    V -= V.max(axis=1, keepdims=True)
    P = np.exp(V); P /= P.sum(axis=1, keepdims=True)
    H = np.zeros((K, K))
    for i in range(n):
        Xi, Pi = X[i], P[i]
        xbar = Pi @ Xi
        H += (Pi[:, None] * Xi).T @ Xi - np.outer(xbar, xbar)
    try:
        se = np.sqrt(np.diag(np.linalg.inv(H)))
    except np.linalg.LinAlgError:
        se = np.full(K, np.nan)
    ll = float(np.log(np.clip(P[np.arange(n), y], 1e-300, None)).sum())
    ll0 = n * math.log(1.0 / X.shape[1])
    return beta, se, 1 - ll / ll0                          # McFadden pseudo-R²


def label_betas(beta: np.ndarray, se: np.ndarray) -> pd.DataFrame:
    rows, k = [], 0
    for (name, n) in ATTRS:
        part = list(beta[k:k + n - 1])
        part.append(-sum(part))                            # effects-coded last level
        errs = list(se[k:k + n - 1]) + [np.nan]
        for lvl, (b, e) in enumerate(zip(part, errs)):
            rows.append({"attribute": name, "level": lvl, "utility": b, "se": e})
        k += n - 1
    return pd.DataFrame(rows)


def price_curve(util: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    """Price utilities ordered by price. Returns (units, utility)."""
    p = util[util.attribute == "price"].sort_values("level")
    return np.array(PRICE_MULT, dtype=float), p.utility.to_numpy()


def units_for_utility(dutil: float, units: np.ndarray, u: np.ndarray,
                      anchor: float = PRICE_ANCHOR) -> float:
    """Price change, in reference items/month, that exactly offsets a utility change.

    Inverts the piecewise-linear price-utility curve. A single linear slope
    through the five price points is wrong: they are unevenly spaced
    (3, 6, 10, 16, 25) and price response is concave, so one slope over- or
    under-states every level by 30-56%.

    A level worse than the reference (longer lock-in, more manual data entry)
    resolves to a negative number rather than falling off the curve. That direction
    is the commercially interesting one: it is what a 12-month contract costs you.

    Returns nan only when the answer lies outside the price range actually
    tested -- which is not a number, it is "beyond the ladder, we did not ask".
    """
    if not np.isfinite(dutil):
        return float("nan")
    order = np.argsort(units)
    s_arr, u_arr = np.asarray(units, float)[order], np.asarray(u, float)[order]
    u_anchor = float(np.interp(anchor, s_arr, u_arr))
    target = u_anchor - dutil
    # Outside the tested ladder, extrapolate along the nearest segment and let
    # the caller flag it. Returning nan instead silently deletes exactly the
    # high-value levels you most want to price.
    if target > u_arr.max():
        seg = (u_arr[1] - u_arr[0]) / (s_arr[1] - s_arr[0])
        s_star = s_arr[0] + (target - u_arr[0]) / seg if abs(seg) > 1e-12 else float("nan")
    elif target < u_arr.min():
        seg = (u_arr[-1] - u_arr[-2]) / (s_arr[-1] - s_arr[-2])
        s_star = s_arr[-1] + (target - u_arr[-1]) / seg if abs(seg) > 1e-12 else float("nan")
    else:
        # u is decreasing in s, so flip for np.interp which needs increasing x
        s_star = float(np.interp(target, u_arr[::-1], s_arr[::-1]))
    return s_star - anchor


def _out_of_range(dutil: float, units: np.ndarray, u: np.ndarray,
                  anchor: float = PRICE_ANCHOR) -> bool:
    """True when the WTP answer lies beyond the price range actually tested."""
    if not np.isfinite(dutil):
        return True
    order = np.argsort(units)
    s_arr, u_arr = np.asarray(units, float)[order], np.asarray(u, float)[order]
    target = float(np.interp(anchor, s_arr, u_arr)) - dutil
    return bool(target > u_arr.max() or target < u_arr.min())


def willingness_to_pay(util: pd.DataFrame) -> pd.DataFrame:
    """WTP in reference items/month, against a fixed reference level, via the price curve."""
    units, u_price = price_curve(util)
    # Test for a MATERIAL inversion, not an exact one. Estimated utilities carry
    # standard errors around 0.10; demanding exact monotonicity flags ordinary
    # sampling noise as a broken price curve. A rise only matters if it is larger
    # than the noise that could have produced it.
    se_price = util[util.attribute == "price"].sort_values("level").se.to_numpy()
    se_fill = np.nanmean(se_price) if np.isfinite(se_price).any() else 0.0
    se_price = np.where(np.isfinite(se_price), se_price, se_fill)
    rises = np.diff(u_price)
    tol = 1.96 * np.sqrt(se_price[:-1] ** 2 + se_price[1:] ** 2)
    monotone = bool(np.all(rises <= tol))
    out = util[util.attribute != "price"].copy()
    ref_u = {a: float(out[(out.attribute == a) & (out.level == REFERENCE[a])].utility.iloc[0])
             for a in out.attribute.unique()}
    out["reference_level"] = out.attribute.map(REFERENCE)
    out["delta_utility"] = out.utility - out.attribute.map(ref_u)
    out["wtp_units"] = [units_for_utility(d, units, u_price) for d in out.delta_utility]
    out["extrapolated"] = [_out_of_range(d, units, u_price) for d in out.delta_utility]
    out["price_curve_monotone"] = monotone
    return out


def attribute_importance(util: pd.DataFrame) -> pd.DataFrame:
    """Utility range per attribute as a share of the total. Baseline-free, so it
    is stable where WTP is not — report this alongside every WTP table."""
    g = util.groupby("attribute").utility.agg(lambda v: v.max() - v.min())
    return (pd.DataFrame({"attribute": g.index, "range": g.to_numpy()})
            .assign(importance_pct=lambda d: d["range"] / d["range"].sum() * 100)
            .sort_values("importance_pct", ascending=False).reset_index(drop=True))


# ──────────────────────────────────────────────── take-rate and coins
def take_rate(sessions: list[dict]) -> tuple[pd.DataFrame, float]:
    """Binary logit on the dual-response 'would you actually buy it' follow-up.

    SPEC 10 asks for this and it was never built. Without it there is no
    take-rate estimate at all: the conditional logit only says which of three
    packages wins, never whether any of them would be bought.
    """
    rows, ybuy = [], []
    for s in sessions:
        for r in s.get("cbc", {}).get("responses", []):
            if r.get("kind") != "design" or r.get("would_buy") is None:
                continue
            rows.append(effects_row(r["profiles"][r["chosen"]]))
            ybuy.append(1 if r["would_buy"] else 0)
    if not rows:
        return pd.DataFrame(), float("nan")
    Xb = np.column_stack([np.ones(len(rows)), np.stack(rows)])
    yb = np.array(ybuy, dtype=float)
    b = np.zeros(Xb.shape[1])
    for _ in range(600):                                # IRLS-free gradient ascent
        p = 1.0 / (1.0 + np.exp(-np.clip(Xb @ b, -30, 30)))
        b += 0.5 * (Xb.T @ (yb - p)) / len(yb)
    p = 1.0 / (1.0 + np.exp(-np.clip(Xb @ b, -30, 30)))
    rows_out = [{"term": "intercept", "coef": b[0]}]
    k = 1
    for (name, n) in ATTRS:
        part = list(b[k:k + n - 1]); part.append(-sum(part))
        for lvl, c in enumerate(part):
            rows_out.append({"term": f"{name}_{lvl}", "coef": c})
        k += n - 1
    return pd.DataFrame(rows_out), float(yb.mean())


def coins_summary(sessions: list[dict]) -> pd.DataFrame:
    """Module 3 allocates coins across the job areas (SPEC 2.3).

    The job count and the coin total are DERIVED, never hardcoded. Both moved on
    14 Sep 2026 (five jobs/ten coins -> six/twelve) and a literal range(5) would
    have dropped the new job silently: no error, just one row missing forever.
    """
    n_jobs = dict(ATTRS)["job"]
    rows = []
    for s in sessions:
        c = s.get("coins") or {}
        if c:
            rows.append({f"job_{k}": c.get(f"job_{k}", 0) for k in range(n_jobs)})
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows)
    total = float(df.sum(axis=1).mean()) or 1.0        # coins actually allocated
    return pd.DataFrame({"job": range(n_jobs),
                         "mean_coins": df.mean().to_numpy(),
                         "share_pct": df.mean().to_numpy() / total * 100,
                         "pct_giving_zero": (df == 0).mean().to_numpy() * 100,
                         "pct_giving_4plus": (df >= 4).mean().to_numpy() * 100})


# ─────────────────────────────────────────────────────────────── benchmarks
# Fields the reveal screen (SPEC 2.6) draws percentile bars from, and where each
# one is read from. Anything listed here but absent from the data is REPORTED as
# missing rather than silently dropped -- the reveal promises five bars and an
# absent field means the owner sees a gap where a bar should be.
BENCHMARK_FIELDS = {
    "seats":            ("profile", "seats"),
    "staff":            ("profile", "_staff_total"),
    "price_ref":        ("profile", "price_ref_toman"),
    "menu_items":       ("observation", "menu_items"),
    "hours_open":       ("observation", "hours_open"),
    "competitors_2min": ("observation", "competitors_2min"),
}


def benchmarks(sessions: list[dict]) -> dict:
    rows = []
    for s in sessions:
        src = {"profile": s.get("profile", {}) or {}, "observation": s.get("observation", {}) or {}}
        src["profile"]["_staff_total"] = ((src["profile"].get("staff_ft") or 0)
                                          + (src["profile"].get("staff_pt") or 0))
        rows.append({name: src[blk].get(key) for name, (blk, key) in BENCHMARK_FIELDS.items()})
    df = pd.DataFrame(rows)
    out = {"n": int(len(df)),
           "generated": pd.Timestamp.now(tz="UTC").isoformat(),
           "missing_fields": []}
    for col in BENCHMARK_FIELDS:
        v = pd.to_numeric(df[col], errors="coerce").dropna().to_numpy(dtype=float)
        if len(v) >= 3:
            out[col] = {"p25": float(np.percentile(v, 25)), "p50": float(np.percentile(v, 50)),
                        "p75": float(np.percentile(v, 75)), "n": int(len(v))}
        else:
            out["missing_fields"].append(col)
    return out


# ───────────────────────────────────────────────────────────────────── main
def main(paths: list[str]):
    raw = load(paths)
    keep, dropped = [], []
    for s in raw:
        ok, why = usable(s)
        (keep if ok else dropped).append((s, why))
    sessions = [s for s, _ in keep]

    lines = [f"sessions read      {len(raw)}",
             f"sessions usable    {len(sessions)}",
             f"excluded           {len(dropped)}"]
    tof = trap_only_flags(sessions)
    if tof:
        lines.append(f"kept but flagged   {len(tof)} failed a trap without being fast "
                     f"-- kept deliberately, see usable() -- {', '.join(tof[:6])}"
                     + (" ..." if len(tof) > 6 else ""))
    for s, why in dropped:
        lines.append(f"   {Path(s['_file']).name}: {why}")

    if not sessions:
        Path("quality_report.txt").write_text("\n".join(lines), encoding="utf-8")
        print("\n".join(lines))
        return

    md = maxdiff_counts(sessions)
    md["rol_utility"] = maxdiff_logit(sessions)[md.item.to_numpy()]
    md.to_csv("maxdiff_scores.csv", index=False)

    X, y = collect_cbc(sessions, kinds=("design",))
    beta, se, r2 = fit_clogit(X, y)
    util = label_betas(beta, se)
    util.to_csv("cbc_utilities.csv", index=False)
    wtp = willingness_to_pay(util)
    wtp.to_csv("wtp.csv", index=False)
    imp = attribute_importance(util)
    imp.to_csv("attribute_importance.csv", index=False)
    tr, tr_raw = take_rate(sessions)
    if not tr.empty:
        tr.to_csv("take_rate.csv", index=False)
    coins = coins_summary(sessions)
    if not coins.empty:
        coins.to_csv("coins.csv", index=False)

    Xh, yh = collect_cbc(sessions, kinds=("holdout",))
    hit = np.nan
    if len(yh):
        Vh = Xh @ beta
        hit = float((Vh.argmax(axis=1) == yh).mean())

    bm = benchmarks(sessions)
    lines += ["",
              f"CBC observations   {len(y)} choice tasks",
              f"pseudo-R2          {r2:.3f}"
              + ("  (thin — treat as directional)" if r2 < 0.15 else ""),
              f"holdout hit rate   {hit:.1%}" if not math.isnan(hit) else "holdout hit rate   n/a",
              f"Johnson-Orme min n 83 respondents; you have {len(sessions)}"
              + ("  <- under, report counting scores as the headline"
                 if len(sessions) < 83 else "  <- met")]

    if not bool(wtp.price_curve_monotone.iloc[0]):
        lines.append("WARNING            price utilities are NOT monotone decreasing; "
                     "WTP is unreliable — inspect cbc_utilities.csv before quoting it")
    extrap = int(wtp.extrapolated.sum())
    if extrap:
        pct = extrap / len(wtp) * 100
        lo, hi = min(PRICE_MULT), max(PRICE_MULT)
        lines.append(f"WTP extrapolated   {extrap}/{len(wtp)} levels ({pct:.0f}%) price out "
                     f"beyond the x{lo:g}-x{hi:g} ladder")
        lines.append("                   their wtp_units is an extrapolation along a "
                     "FLATTENING curve and is wildly overstated.")
        lines.append(f"                   Read them as 'worth more than {max(PRICE_MULT):g} "
                     f"{PRICE_UNIT}', never as "
                     "the printed number. See extrapolated=True in wtp.csv.")
        if pct > 25:
            lines.append("ACTION             more than a quarter of levels price out. The "
                         "price ladder is too narrow for this")
            lines.append("                   population — raise the top multiplier and "
                         "re-run the design before the next batch.")
    if not math.isnan(tr_raw):
        lines.append(f"raw take-rate      {tr_raw:.1%} said they would actually buy "
                     f"their chosen package")
    if bm["missing_fields"]:
        lines.append("benchmark gaps     " + ", ".join(bm["missing_fields"])
                     + "  (reveal screen will show fewer bars than SPEC 2.6 promises)")
    lines.append("")
    lines.append("attribute importance (baseline-free, quote this alongside WTP):")
    for _, r in imp.iterrows():
        lines.append(f"   {r.attribute:9s} {r.importance_pct:5.1f}%   range {r['range']:.3f}")

    Path("benchmarks.json").write_text(
        json.dumps(bm, ensure_ascii=False, indent=1), encoding="utf-8")
    Path("quality_report.txt").write_text("\n".join(lines), encoding="utf-8")
    print("\n".join(lines))
    print("\nwrote maxdiff_scores.csv  cbc_utilities.csv  wtp.csv  benchmarks.json")


if __name__ == "__main__":
    main(sys.argv[1:] or ["../sessions/*.json"])
