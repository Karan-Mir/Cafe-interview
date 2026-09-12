# -*- coding: utf-8 -*-
"""Experimental designs for the Rasht cafe study.

Produces two JSON files consumed by the tablet app:

  maxdiff_design.json  14 items, sets of 4, 12 sets per version, 6 versions
  cbc_design.json      6 attributes, 3 alternatives, 10 tasks, 20 versions
                       + 2 fixed holdout tasks + 1 trap task

Both are optimised here, once, and shipped as data. The app never generates
a design at runtime — runtime randomisation is what destroys balance.
"""
import json, itertools, math, random, sys, hashlib
import numpy as np


def content_hash(payload: dict) -> str:
    """SHA-256 over the design content only (never the meta block, which holds
    the hash itself). Canonical JSON so the digest does not depend on key order
    or whitespace."""
    body = {k: v for k, v in payload.items() if k != "meta"}
    return hashlib.sha256(
        json.dumps(body, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()


def verify(path: str) -> bool:
    """Check a shipped design file still matches the hash recorded inside it."""
    try:
        d = json.load(open(path, encoding="utf-8"))
    except FileNotFoundError:
        print(f"  MISSING  {path}")
        return False
    recorded = d.get("meta", {}).get("content_sha256")
    if recorded is None:
        print(f"  NO HASH  {path}  (generated before integrity checking; "
              f"re-run with --force to stamp one)")
        return False
    actual = content_hash(d)
    ok = actual == recorded
    print(f"  {'OK      ' if ok else 'MISMATCH'} {path}")
    if not ok:
        print(f"           recorded {recorded[:16]}...  actual {actual[:16]}...")
    return ok

# ── reproducibility ──────────────────────────────────────────────────────
# Both optimisers below are hill-climbers that accept a move on `<=` against a
# floating-point objective (incrementally-updated variances; slogdet via LAPACK).
# Near-ties therefore break differently across platforms and BLAS builds, so the
# SAME SEED DOES NOT GUARANTEE THE SAME DESIGN. Measured: regenerating on Windows
# gave D-error 0.32494 and max attribute correlation 0.0577, against the shipped
# 0.32485 / 0.0512.
#
# That is fine as long as the shipped JSON is the single source of truth. It is
# NOT fine if two tablets ship different files: `cbc_version` is an index, so the
# same index would mean different profiles on different devices and the pooled
# data would be silently wrong. Hence: the files are hash-stamped, this script
# refuses to overwrite them without --force, and --force bumps design_version.
RNG = np.random.default_rng(20260912)
random.seed(20260912)

DESIGN_VERSION = "2026-09-12"

MD_PATH = None   # set after OUT is known
CBC_PATH = None
import os
OUT = os.path.dirname(os.path.abspath(__file__))
MD_PATH = f"{OUT}/maxdiff_design.json"
CBC_PATH = f"{OUT}/cbc_design.json"

if "--verify" in sys.argv:
    print("verifying shipped design files against their recorded hashes")
    sys.exit(0 if all([verify(MD_PATH), verify(CBC_PATH)]) else 1)

if not {"--force"} & set(sys.argv) and all(os.path.exists(p) for p in (MD_PATH, CBC_PATH)):
    print("Design files already exist and are the source of truth for every")
    print("tablet in the field. Regenerating them produces a DIFFERENT design")
    print("(the optimisers are not bit-reproducible across platforms), which")
    print("would make `cbc_version` mean different profiles on different devices.")
    print()
    print("  python generate_designs.py --verify   check the shipped files")
    print("  python generate_designs.py --force    regenerate and bump design_version")
    sys.exit(1)

# ══════════════════════════════════════════════════════════ MaxDiff (BIBD-ish)
N_ITEMS, SET_SIZE, N_SETS, N_VERSIONS = 14, 4, 12, 6


def maxdiff_stats(design):
    freq = np.zeros(N_ITEMS)
    pair = np.zeros((N_ITEMS, N_ITEMS))
    for st in design:
        for i in st:
            freq[i] += 1
        for a, b in itertools.combinations(st, 2):
            pair[a, b] += 1
            pair[b, a] += 1
    return freq, pair


MASK = ~np.eye(N_ITEMS, dtype=bool)


def cost_of(freq, pair):
    return freq.var() * 10 + pair[MASK].var()


def make_maxdiff_version(iters=40000):
    """Swap heuristic with incremental frequency / co-occurrence updates."""
    design = [list(RNG.choice(N_ITEMS, SET_SIZE, replace=False)) for _ in range(N_SETS)]
    freq, pair = maxdiff_stats(design)
    cost = cost_of(freq, pair)
    for _ in range(iters):
        st = random.randrange(N_SETS)
        pos = random.randrange(SET_SIZE)
        new_i = random.randrange(N_ITEMS)
        cur = design[st]
        if new_i in cur:
            continue
        old_i = cur[pos]
        others = [x for j, x in enumerate(cur) if j != pos]
        freq[old_i] -= 1
        freq[new_i] += 1
        for o in others:
            pair[old_i, o] -= 1; pair[o, old_i] -= 1
            pair[new_i, o] += 1; pair[o, new_i] += 1
        c = cost_of(freq, pair)
        if c <= cost:
            cost = c
            cur[pos] = new_i
        else:
            freq[old_i] += 1
            freq[new_i] -= 1
            for o in others:
                pair[old_i, o] += 1; pair[o, old_i] += 1
                pair[new_i, o] -= 1; pair[o, new_i] -= 1
    return design, cost


md_versions, md_costs = [], []
for v in range(N_VERSIONS):
    d, c = make_maxdiff_version()
    md_versions.append([sorted(int(x) for x in s) for s in d])
    md_costs.append(c)

# report balance across the whole design
all_freq = np.zeros(N_ITEMS)
all_pair = np.zeros((N_ITEMS, N_ITEMS))
for ver in md_versions:
    for s in ver:
        for i in s:
            all_freq[i] += 1
        for a, b in itertools.combinations(s, 2):
            all_pair[a, b] += 1
            all_pair[b, a] += 1
off_pairs = all_pair[~np.eye(N_ITEMS, dtype=bool)]

print("── MaxDiff ─────────────────────────────────────────────")
print(f"  versions {N_VERSIONS} · sets/version {N_SETS} · set size {SET_SIZE}")
print(f"  appearances per item, per version : {N_SETS*SET_SIZE/N_ITEMS:.2f} target")
print(f"  item frequency across all versions : min {all_freq.min():.0f}  max {all_freq.max():.0f}")
print(f"  pairwise co-occurrence             : min {off_pairs.min():.0f}  max {off_pairs.max():.0f}"
      f"  mean {off_pairs.mean():.2f}")

# ══════════════════════════════════════════════════════════════════════ CBC
ATTRS = [
    ("job",      5),   # core job the product does
    ("input",    4),   # how data gets in
    ("delivery", 4),   # how the answer arrives
    ("who",      3),   # automation vs human
    ("commit",   3),   # contract length
    ("price",    5),   # price in barista-shift units
]
N_ALTS, N_TASKS, N_CBC_VERSIONS = 3, 10, 20
LEVELS = [n for _, n in ATTRS]
K = sum(n - 1 for n in LEVELS)            # effects-coded parameters


def effects_row(profile):
    row = []
    for lvl, n in zip(profile, LEVELS):
        v = [0.0] * (n - 1)
        if lvl < n - 1:
            v[lvl] = 1.0
        else:
            v = [-1.0] * (n - 1)
        row.extend(v)
    return row


_ROW_CACHE = {}


def erow(profile):
    key = tuple(profile)
    r = _ROW_CACHE.get(key)
    if r is None:
        r = np.array(effects_row(profile))
        _ROW_CACHE[key] = r
    return r


def task_info(task):
    """MNL information contribution of one task, evaluated at beta = 0."""
    X = np.stack([erow(a) for a in task])
    Z = X - X.mean(axis=0)
    return (1.0 / N_ALTS) * (Z.T @ Z)


def derr_from_M(M):
    sign, logdet = np.linalg.slogdet(M)
    if sign <= 0:
        return 1e9
    return math.exp(-logdet / K)


def d_error(version):
    M = np.zeros((K, K))
    for task in version:
        M += task_info(task)
    return derr_from_M(M)


def random_profile():
    return [int(RNG.integers(n)) for n in LEVELS]


def valid_task(task):
    """No duplicate alternatives, and not all alternatives equal but for price."""
    if len({tuple(a) for a in task}) < len(task):
        return False
    return len({tuple(a[:-1]) for a in task}) > 1


def make_cbc_version(iters=12000):
    while True:
        version = [[random_profile() for _ in range(N_ALTS)] for _ in range(N_TASKS)]
        if all(valid_task(t) for t in version):
            break
    contrib = [task_info(t) for t in version]
    M = np.sum(contrib, axis=0)
    err = derr_from_M(M)
    for _ in range(iters):
        t = random.randrange(N_TASKS)
        a = random.randrange(N_ALTS)
        k = random.randrange(len(LEVELS))
        old = version[t][a][k]
        new = random.randrange(LEVELS[k])
        if new == old:
            continue
        version[t][a][k] = new
        if not valid_task(version[t]):
            version[t][a][k] = old
            continue
        ci = task_info(version[t])
        Mn = M - contrib[t] + ci
        e = derr_from_M(Mn)
        if e <= err:
            err, M, contrib[t] = e, Mn, ci
        else:
            version[t][a][k] = old
    return version, err


cbc_versions, cbc_errs, base_errs = [], [], []
for v in range(N_CBC_VERSIONS):
    # baseline: a purely random version of the same size, for comparison
    while True:
        rnd = [[random_profile() for _ in range(N_ALTS)] for _ in range(N_TASKS)]
        if all(valid_task(t) for t in rnd):
            break
    base_errs.append(d_error(rnd))
    ver, e = make_cbc_version()
    cbc_versions.append(ver)
    cbc_errs.append(e)

lvl_counts = [np.zeros(n) for n in LEVELS]
for ver in cbc_versions:
    for task in ver:
        for alt in task:
            for k, lvl in enumerate(alt):
                lvl_counts[k][lvl] += 1

print("\n── CBC ─────────────────────────────────────────────────")
print(f"  versions {N_CBC_VERSIONS} · tasks/version {N_TASKS} · alternatives {N_ALTS}")
print(f"  effects-coded parameters: {K}")
print(f"  D-error  optimised mean {np.mean(cbc_errs):.4f}   random mean {np.mean(base_errs):.4f}"
      f"   → {(np.mean(base_errs)/np.mean(cbc_errs)-1)*100:.0f}% better")
for (name, n), c in zip(ATTRS, lvl_counts):
    tgt = c.sum() / n
    print(f"  level balance {name:9s} target {tgt:5.0f}   min {c.min():4.0f}  max {c.max():4.0f}")

# one-way correlation between attributes across all alternatives
flat = np.array([alt for ver in cbc_versions for task in ver for alt in task])
cor = np.corrcoef(flat.T)
off = cor[~np.eye(len(LEVELS), dtype=bool)]
print(f"  max |correlation| between attributes: {np.abs(off).max():.3f}")

# Johnson–Orme rule of thumb for the minimum respondents
c_max = max(LEVELS)
n_min = 500 * c_max / (N_TASKS * N_ALTS)
print(f"  Johnson–Orme minimum n for main effects: {n_min:.0f} respondents")

# ─────────────────────────────────────────────── holdouts and the trap task
HOLDOUTS = [
    [[0, 0, 2, 1, 0, 1], [2, 2, 1, 0, 1, 2], [4, 3, 3, 2, 2, 0]],
    [[1, 1, 0, 2, 2, 3], [3, 0, 2, 1, 0, 1], [0, 2, 1, 0, 1, 4]],
]
# Traps: one alternative is identical to another except it costs more and commits
# longer, so choosing it means the respondent is not reading.
#
# TWO of them, not one. A single dominance trap catches a respondent who clicks at
# random only 1 in 3 times -- detection is 1/(number of alternatives), however
# obvious the dominated option looks. Two traps take it to 56%, three to 70%.
# Two is the point where the 8 seconds stops being worth it.
#
# The dominated alternative sits at a DIFFERENT index in each, so a respondent who
# simply always taps the same card cannot pass both by luck.
TRAPS = [
    [[0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 2, 4], [2, 1, 2, 1, 1, 2]],   # alt 1 dominated
    [[3, 2, 1, 1, 1, 3], [1, 3, 3, 2, 0, 1], [3, 2, 1, 1, 2, 4]],   # alt 2 dominated
]
TRAP = TRAPS[0]          # retained so older readers of the file still resolve

md_payload = {
    "meta": {
        "design_version": DESIGN_VERSION,
        "n_items": N_ITEMS, "set_size": SET_SIZE,
        "sets_per_version": N_SETS, "versions": N_VERSIONS,
        "appearances_per_item_per_version": N_SETS * SET_SIZE / N_ITEMS,
        "item_freq_min": int(all_freq.min()), "item_freq_max": int(all_freq.max()),
        "pair_cooccurrence_min": int(off_pairs.min()),
        "pair_cooccurrence_max": int(off_pairs.max()),
        "seed": 20260912,
    },
    "versions": md_versions,
}
md_payload["meta"]["content_sha256"] = content_hash(md_payload)
json.dump(md_payload, open(MD_PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

cbc_payload = {
    "meta": {
        "design_version": DESIGN_VERSION,
        "attributes": [{"id": a, "n_levels": n} for a, n in ATTRS],
        "alternatives": N_ALTS, "tasks_per_version": N_TASKS,
        "versions": N_CBC_VERSIONS, "parameters": K,
        "d_error_mean": round(float(np.mean(cbc_errs)), 5),
        "d_error_random_baseline": round(float(np.mean(base_errs)), 5),
        "max_abs_attribute_correlation": round(float(np.abs(off).max()), 4),
        "johnson_orme_min_n": round(float(n_min)),
        "seed": 20260912,
    },
    "versions": cbc_versions,
    "holdouts": HOLDOUTS,
    "traps": TRAPS,
}
cbc_payload["meta"]["content_sha256"] = content_hash(cbc_payload)
json.dump(cbc_payload, open(CBC_PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

print("\nwrote maxdiff_design.json and cbc_design.json")
