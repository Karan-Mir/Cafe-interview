# قهوه‌سنج

Offline Persian tablet instrument for measuring what Rasht café owners will trade off.
A MaxDiff and a choice-based conjoint, delivered as a nine-minute game, ending in a
benchmark card the owner keeps.

**Start with `SPEC.md`.** It is the build contract.

```
SPEC.md                     the build specification — read this first
src/
  core/                     session store, dexie schema, design loader, export, quality
  content/                  all Persian copy, the 14 concepts, the 6 attributes
  modules/                  Preflight, M00Open … M07Observe
  ui/                       chips, steppers, café card, progress
design/
  generate_designs.py       regenerates both designs; refuses to overwrite without --force
  maxdiff_design.json       14 items, sets of 4, 12 sets, 6 versions   (shipped data)
  cbc_design.json           6 attributes, 3 alts, 10 tasks, 20 versions (shipped data)
analysis/
  analyse.py                reads exported sessions -> scores, utilities, WTP, take-rate,
                            importance, coins, benchmarks
  simulate_and_verify.py    acceptance test: plants known preferences, checks recovery
sessions/                   exported session JSON lands here
```

## Running the tablet app

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # dist/ — installable PWA, works in airplane mode
```

Vite + React 18 + TypeScript, Zustand over Dexie, Vazirmatn self-hosted. No CDN
anywhere: Google Fonts is unreachable from Iran and the app must survive a café with
no wifi and a tablet with no SIM. The service worker precaches everything (~436 KiB).

The app **verifies the design files against their own hashes at startup** and refuses
to run if they do not match, because `cbc_version` is an index and two tablets carrying
different design files would silently poison the pooled data.

## Live

**App (collectors):** https://karan-mir.github.io/Cafe-interview/
Open once per phone on wifi, then add to home screen. After that it runs with no
network at all — the service worker precaches everything.

**Data (admins):** inside the app — long-press the wordmark on the pre-flight
screen, or the پنل مدیریت button, and sign in. Sessions upload themselves within
seconds of an interview ending; the phone keeps a copy only until the server
confirms the row, then purges it.

Backend is Supabase (`eu-west-1`). Schema and policies in `supabase/schema.sql`.
The publishable key in `.env.production` is public by design: Vite inlines it
into the bundle, and RLS grants `anon` no read and no write. Verified against a
live row — anonymous SELECT returns `[]` with data present, anonymous INSERT
returns 401.

## Deploying

Two repos, because GitHub Pages only serves a **public** repo on the free plan and
café data must not be public:

| repo | visibility | holds |
|---|---|---|
| `qahvesanj` | public | the app. `.github/workflows/deploy.yml` publishes it to Pages. |
| `qahvesanj-field` | **private** | collected sessions. `analyse.yml` regenerates `benchmarks.json` on every push. |

The app holds no secrets — sync tokens are entered per device and live in that
device's storage, never in the bundle.

1. Push this project to the public repo. Settings → Pages → Source: **GitHub Actions**.
2. Create the private data repo. Add the second collector as a collaborator.
3. In `analyse.yml`, set `APP_REPO` to your public repo. It checks the app repo out
   and uses **its** `design/` and `analysis/` — so there is exactly one design file
   of record. Copying the design into the data repo would recreate the
   two-different-designs failure this project exists to avoid.
4. Each collector: GitHub → Settings → Developer settings → **fine-grained** PAT,
   scoped to the data repo only, `Contents: read and write`, with an expiry.
5. On each phone: open the Pages URL once on wifi, add to home screen, then
   long-press the wordmark → PIN → sync panel → enter owner, repo, token, device id.

After that the phone never needs the network to run a session.

## Before a field day

```bash
cd design && python generate_designs.py --verify
```

Must print `OK` for both files. The design JSON is the artefact of record for every
tablet: `cbc_version` is an *index*, so two devices carrying different files would record
the same index against different profiles. The optimisers are **not** bit-reproducible
across platforms — the same seed gives a different design on a different machine — so the
shipped file is hash-stamped and regenerating it is a deliberate act (`--force`, which
bumps `design_version`).

## After any change to a design or the estimator

```bash
cd analysis && python simulate_and_verify.py
```

Must end `ACCEPTANCE: PASS`. Fifteen checks: utility and MaxDiff recovery, holdout hit
rate, trap mechanism and detection rate, quality-screen sensitivity and false-drop rate,
WTP error and correlation, price-ladder coverage, take-rate, benchmark completeness,
price-curve monotonicity, and shrinkage under homogeneous respondents. If it fails, the field data will be wrong in a way nobody notices.

## Analysing a real batch

```bash
cd analysis && python analyse.py ../sessions/*.json
```

Read `quality_report.txt` first — exclusions, holdout hit rate, attribute importance, and
any warning about the price ladder or missing benchmark fields.

Requires numpy and pandas. Nothing else.

**On Windows**, set `PYTHONIOENCODING=utf-8` before running either script, or the Persian
output dies on cp1252.
