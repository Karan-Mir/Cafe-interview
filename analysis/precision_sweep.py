# -*- coding: utf-8 -*-
"""Measured precision by number of completed interviews.

Simulates careful respondents against the SHIPPED design with known part-worths
planted, fits the real conditional logit from analyse.py, and reports how far the
recovered numbers sit from the truth.

    python precision_sweep.py            # default 10 replicates per row
    python precision_sweep.py 20         # 20 replicates, slower and tighter

Careless respondents are deliberately EXCLUDED here: this measures sampling
precision alone. The quality screen's behaviour is measured in
simulate_and_verify.py instead.
"""
from __future__ import annotations
import sys, json, math
from pathlib import Path
import numpy as np
import pandas as pd

import analyse as A
from simulate_and_verify import TRUE, cbc_design, utility

REPS = int(sys.argv[1]) if len(sys.argv) > 1 else 10
GRID = [20, 25, 30, 40, 50, 60, 83, 100, 120, 160, 200]
SD = 0.25                      # respondent heterogeneity, "moderate" in the spec
PRICE_SPAN = A.PRICE_MULT[-1] - A.PRICE_MULT[0]      # x3 .. x25 = 22 coffees


def true_util_frame() -> pd.DataFrame:
    """The planted truth, shaped like analyse.label_betas output."""
    rows = []
    for name, n in A.ATTRS:
        v = np.array(TRUE[name][:n], dtype=float)
        v = v - v.mean()                       # effects coding: sum to zero
        for lvl in range(n):
            rows.append({"attribute": name, "level": lvl, "utility": v[lvl]})
    return pd.DataFrame(rows)


def simulate(n: int, rng: np.random.Generator) -> list[dict]:
    out = []
    for i in range(n):
        v = i % cbc_design["meta"]["versions"]
        jitter = {k: np.array(val) + rng.normal(0, SD, len(val))
                  for k, val in TRUE.items()}
        resp = []
        for t, task in enumerate(cbc_design["versions"][v]):
            u = np.array([sum(jitter[nm][lv] for (nm, _), lv in zip(A.ATTRS, p))
                          for p in task]) + rng.gumbel(0, 1, len(task))
            resp.append({"task": t, "kind": "design", "position": t,
                         "profiles": task, "chosen": int(np.argmax(u)),
                         "would_buy": True, "latency_ms": 5200})
        out.append({"schema": 1, "session_id": f"p{i:04d}",
                    "design_version": cbc_design["meta"]["design_version"],
                    "price_mult": A.PRICE_MULT,
                    "consent": {"analysis": True}, "profile": {},
                    "maxdiff": {"version": 0, "responses": []}, "coins": {},
                    "cbc": {"responses": resp}, "quality": {"completed": True, "fast_tasks": 0,
                                             "trap_failed": False,
                                             "straightlined": False}})
    return out


def one_run(n: int, rng) -> dict:
    sessions = simulate(n, rng)
    X, y = A.collect_cbc(sessions)
    beta, se, _ll = A.fit_clogit(X, y)   # returns (beta, se, loglik)
    util = A.label_betas(beta, se)
    truth = true_util_frame()

    m = util.merge(truth, on=["attribute", "level"], suffixes=("_hat", "_true"))
    corr = float(np.corrcoef(m.utility_hat, m.utility_true)[0, 1])

    # does it pick the right best level of each attribute?
    right = sum(
        int(m[m.attribute == a].sort_values("utility_hat").level.iloc[-1] ==
            m[m.attribute == a].sort_values("utility_true").level.iloc[-1])
        for a, _ in A.ATTRS)

    # WTP error, in coffees per month, against WTP computed from the truth
    wtp_hat = A.willingness_to_pay(util)
    wtp_true = A.willingness_to_pay(truth.assign(se=0.0))
    w = wtp_hat.merge(wtp_true, on=["attribute", "level"], suffixes=("_hat", "_true"))
    w = w[(~w.extrapolated_hat) & (~w.extrapolated_true)]
    err = float(np.abs(w.wtp_units_hat - w.wtp_units_true).mean()) if len(w) else np.nan

    return {"corr": corr, "right": right / len(A.ATTRS),
            "wtp_err": err, "mean_se": float(util.se.dropna().mean())}


def main() -> None:
    print(f"\nPrecision by completed interviews -- {REPS} replicates per row, "
          f"heterogeneity sd={SD}")
    print(f"design {cbc_design['meta']['design_version']}, "
          f"{cbc_design['meta']['tasks_per_version']} tasks x "
          f"{cbc_design['meta']['alternatives']} alternatives\n")
    print(f"{'cafes':>6} {'obs':>6} {'util corr':>10} {'WTP err':>9} "
          f"{'mean SE':>8} {'best level':>11}")
    print("-" * 56)
    rows = []
    for n in GRID:
        runs = [one_run(n, np.random.default_rng(4000 + n * 97 + r))
                for r in range(REPS)]
        r = {k: float(np.nanmean([x[k] for x in runs])) for k in runs[0]}
        r["n"], r["obs"] = n, n * cbc_design["meta"]["tasks_per_version"]
        rows.append(r)
        mark = "  <- Johnson-Orme floor" if n == 83 else ""
        print(f"{n:>6} {r['obs']:>6} {r['corr']:>10.3f} "
              f"{r['wtp_err']:>8.2f}c {r['mean_se']:>8.3f} "
              f"{r['right']*100:>10.0f}%{mark}")
    pd.DataFrame(rows)[["n", "obs", "corr", "wtp_err", "mean_se", "right"]] \
        .to_csv("precision_by_n.csv", index=False)
    print("\nWTP error is the mean absolute gap, in coffees per month, against the")
    print("planted truth, over levels that price inside the x3-x25 ladder.")
    print("wrote precision_by_n.csv")


if __name__ == "__main__":
    main()
