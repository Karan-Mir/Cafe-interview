# قهوه‌سنج — Build Specification

An offline-first Persian tablet app that measures what Rasht café owners will actually
trade off, disguised as a nine-minute game. Hand the tablet over, they play, they get
a benchmark card back, you get choice data.

This document is the build contract. Where it is specific, follow it exactly — several
choices that look arbitrary are load-bearing for the statistics and are marked
**[STATS]**. Where it is silent, use judgement and note the decision in `DECISIONS.md`.

---

## 0. Non-negotiables

Read these before writing any code. Each one has broken a study like this before.

1. **The design is data, not code.** `design/maxdiff_design.json` and
   `design/cbc_design.json` are generated once, offline, by `design/generate_designs.py`
   and shipped with the app. **[STATS]** The app must never generate, shuffle, or
   "freshen" a choice set at runtime. Runtime randomisation destroys the level balance
   and near-orthogonality that make the model estimable.
2. **No scoring, no timer, no leaderboard.** See §7. Rewarding speed produces speeding;
   rewarding "good" answers produces the answers the player thinks you want. There are
   no correct answers in this instrument.
3. **No section is skippable and no section may be reordered.** Module order is the
   design. The MaxDiff must precede the conjoint, and the open question must precede
   the reveal.
4. **Works in airplane mode, start to finish.** No network call is on the critical path.
   Fonts, designs, and assets are bundled. Assume the café has no usable wifi and the
   tablet has no SIM.
5. **Nothing is ever deleted from the device without an explicit export first.** A lost
   session is an hour of fieldwork and a café you cannot ask twice.
6. **Never ask for money figures — and that now includes wages.** No revenue, no profit,
   no rent, no tax, no staff pay. Price is expressed in multiples of the café's own
   standard coffee (§3.6.6), which the interviewer reads off the menu. The owner is asked
   for no financial number at any point, so the opening promise
   «نه هیچ عدد مالی از شما نمی‌خوام» is now literally true rather than nearly true. This is
   why owners agree to play at all; do not trade it away for a more convenient unit.

---

## 1. Why this shape (read once, then build)

Stated preference is unreliable: "would you like X?" measures politeness. Forced
trade-off is reliable: to get X you must give up Y and pay more, and the exchange rate
is what we want. So the core of the instrument is a **choice-based conjoint (CBC)**.

CBC can only rank things you already thought of. So it is preceded by a **MaxDiff** that
cheaply sorts fourteen candidate products, and followed by a **60-second open question**
that is the only escape hatch from our own imagination. Keep all three.

The gamification is the *delivery*, not the method. Its job is to get a busy café owner
to finish nine minutes of trade-offs without feeling interrogated, and to make the
ending feel like a gift rather than an exit.

---

## 2. Module flow

Total target: **9–11 minutes**. Timings are budgets, not enforced limits — never show a
countdown to the player.

| # | Module | Budget | Screen count |
|---|--------|--------|--------------|
| 0 | Cold open + consent | 0:30 | 1 |
| 1 | کارت کافه — profile card builder | 1:30 | 4 |
| 2 | MaxDiff — «کدوم بیشتر، کدوم کمتر» | 3:00 | 12 |
| 3 | سکه‌ها — coin allocation | 0:45 | 1 |
| 4 | CBC — «کدوم بسته رو برمی‌داری» | 3:30 | 13 |
| 5 | صدا — the open question | 1:00 | 1 |
| 6 | کارت مقایسه — the reveal | 1:00 | 2 |
| 7 | Observation (interviewer only) | 2:00 | 1, PIN-gated |

### 2.0 Cold open

One screen. Large Persian headline, a single primary button, nothing else.

> **قهوه‌سنج**
> نُه دقیقه، بدون هیچ سؤال مالی.
> آخرش می‌بینی کافه‌ات کجای بازار رشت ایستاده.
> `[ شروع ]`

Consent is a single checked-by-default row *below* the button — «اجازه می‌دم جواب‌هام
بی‌نام در تحلیل بازار استفاده بشه» — with a one-tap «توضیح بیشتر» sheet. Do not build a
consent wall. If the owner unchecks it, still run the session but set
`consent.analysis = false` and exclude on export.

The interviewer enters their initials and a session PIN *before* handing over, on a
pre-flight screen that is not part of the player's flow.

**[STATS] The pre-flight screen also captures the price reference**, because module 4
cannot render a price without it:

- `price_ref_item` — chips: اسپرسو / قهوهٔ ساده / چای
- `price_ref_toman` — the menu price of that item

**Read it off the menu. Do not ask.** Take the espresso price; if the café has no espresso
take any standard coffee; if it has neither — a قلیان-focused place may not — take tea.
Record which, so the analysis can check whether the choice of item mattered. The menu is
public, it is usually on the wall, and the owner is never put in the position of naming a
figure to a stranger.

### 2.1 کارت کافه — profile card builder

Four screens, chips and steppers only. **No text inputs.** Each tap builds a visible
café "card" at the top of the screen that fills in as they go — this card is the object
they get back at the end, so it must look good from the first tap.

Collect, in this order:
1. `years` stepper, `branches` chips (یک / دو / سه یا بیشتر / در فکر شعبهٔ بعدی)
2. `staff_ft`, `staff_pt` steppers, `shifts` chips (یک / دو)
3. `type` chips (قهوه‌محور / کافه‌رستوران / سنتی / بیرون‌بر محور / قنادی / ترکیبی),
   `seats` stepper
4. `pos` chips (ندارم / صندوق ساده / نرم‌افزار فروش / نرم‌افزار با گزارش), `seats` stepper

**No money question anywhere in module 1.** An earlier revision asked what a barista costs
per month, in bands, to denominate the price ladder. It has been removed. It was the
instrument's one mandatory financial question, sitting inside a promise not to ask any —
and it was a hard dependency, so an owner declining it took the whole conjoint down with
it, not one field. The denominator now comes off the menu, on the pre-flight screen, and
cannot be refused because it is never requested.

### 2.2 MaxDiff

12 screens. Each shows 4 of the 14 items (§3.5) as large cards in a 2×2 grid.

Interaction: tap once to mark **بهترین** (green outline, up chevron), tap a different
card twice — or long-press — to mark **بی‌فایده‌ترین** (muted outline, down chevron).
Best and worst must be different items; auto-advance ~250 ms after both are set, with a
subtle slide transition. Provide a back arrow that restores the previous screen's state.

Item order *within* a screen may be shuffled per respondent — that is presentation
order, not design. The set composition and the set order come from the design file.

**[STATS]** Assign `maxdiff_version = hash(session_id) % 6` and record it. Six versions
exist; balance across them at recruitment time is not required but roughly even
assignment is desirable.

### 2.3 سکه‌ها — coin allocation

One screen. Ten coin tokens, drag or tap-to-add onto the five *job* areas from §3.6.1.
Must allocate exactly 10 before advancing; show remaining count, never a timer.

> «ده تا سکه داری. بذارشون روی کاری که بیشتر از همه دلت می‌خواد حل بشه.»

This measures intensity, which MaxDiff (a ranking) cannot. It is also the module to cut
first if field timings run long — mark it `optional: true` in config so it can be
switched off without a rebuild.

### 2.4 CBC — the core

14 screens: 10 design tasks + 2 holdout tasks + **2 trap tasks**, in a randomised order
*of the fixed set* (the assignment of which tasks are holdouts/traps is fixed in the
design file; only their position in the sequence varies).

**[STATS] Shuffle the three cards' left-to-right positions within each task**, per
respondent per task, and record `profiles` in the order actually shown with `chosen`
indexing that same order. Fixed positions invite a left-right bias that is
indistinguishable from preference. This is presentation, not design — the *composition*
of each task still comes from the design file.

**[STATS] Detect a failed trap by comparing the chosen profile to the dominated one,
never by its index.** Because positions are shuffled, the dominated alternative is not at
a fixed index. An index test (`chosen == 1`) silently stops working the moment shuffling
is switched on, and nothing about the output looks wrong.

Each screen shows 3 packages side by side as cards, each card listing the six attributes
as icon + short label (§3.6). Price is the last row of each card, rendered in toman from
the owner's own barista-shift figure, with the shift equivalent beneath it in small type.

> «کدوم رو برمی‌داری؟»

**Dual-response none.** **[STATS]** After they tap a package, a second, quieter question
slides up:

> «اگه همین الان بود، واقعاً می‌گرفتیش؟»  `[ آره ]` `[ نه ]`

Record both. This yields far more information than a plain "none of these" option and it
is what makes a credible take-rate estimate possible. Do not replace it with a third
"هیچ‌کدام" card.

Record `latency_ms` per task from screen paint to first tap.

### 2.5 صدا — the open question

One screen, one big record button, 45-second cap, waveform while recording, playback and
re-record allowed.

> «اگه یه دستیار داشتی که هر کاری بخوای برات می‌کرد — اول ازش چی می‌خواستی؟»

Store as a local audio blob keyed to the session; transcribe later, off-device. Offer a
keyboard fallback but make voice the obvious default: typing Persian on a borrowed
tablet is a completion-rate killer.

### 2.6 کارت مقایسه — the reveal

Two screens, and the reason anyone plays.

Screen 1 animates the café's card into a comparison against the cafés already in the
dataset: percentile bars for price level, menu size, seats, staff, and opening hours.
Read the percentiles from a bundled `benchmarks.json` that the analysis repo regenerates
after each fieldwork batch.

**Honesty rule.** If `benchmarks.n < 12`, show the count prominently and label it
«هنوز کمه — با هر کافهٔ جدید دقیق‌تر می‌شه». Never present a percentile computed from a
handful of cafés as if it were the market. This is also the recruitment hook, so it is
in your interest to say it plainly.

Screen 2 is the ask: a share sheet for the card image, a referral field
(«کدوم کافه‌دار رو بگم ببینم؟», two slots), and the permission toggles — the analysis
sheet visit, and willingness to pilot.

### 2.7 Observation — interviewer only

Reachable only by a long-press on the قهوه‌سنج logo plus the session PIN, so the owner
never sees it. Same fields as the paper instrument's observation block: capacity,
occupancy at visit, five menu prices, menu type, POS visible, order-taking method
observed, location, signage, competitors within two minutes' walk, wifi, outlets, queue,
Instagram handle and follower count.

**[STATS]** Order-taking method must be *observed*, never asked. It is the single most
reliable indicator of which data layer the café sits on.

**`menu_items` and `hours_open` are required.** §2.6 promises the owner five percentile
bars — price, menu size, seats, staff, hours. Menu size and opening hours are collected
nowhere else, so without them the reveal screen shows gaps where bars should be, and the
reveal is the only reason anyone plays. `analyse.py` lists any missing benchmark field in
`quality_report.txt`; that list must be empty before a batch ships.

---

## 3. Content

All UI copy is Persian, RTL. Keep sentences short and spoken — these are read off a
tablet by someone who may be standing up.

### 3.5 MaxDiff items (14)

Index order is fixed and must match `maxdiff_design.json`.

| # | عنوان | یک خط توضیح |
|---|-------|--------------|
| 0 | برگهٔ ماهانه | هر ماه یک صفحه: سه عدد که باید بدانی و سه کاری که این ماه بکنی |
| 1 | هشدار قیمت تمام‌شده | وقتی گرانی مواد سود یک آیتم را خورد، پیام می‌آید |
| 2 | منوی سودده | می‌گوید کدام آیتم را برداری، کدام را گران کنی |
| 3 | پیش‌بینی شلوغی هفتهٔ بعد | برای چیدن شیفت |
| 4 | پیشنهاد سفارش مواد | بر اساس فروش خودت می‌گوید این هفته چقدر بگیری |
| 5 | ثبت ضایعات با عکس | کارمند عکس می‌گیرد، آخر ماه فهرستش را داری |
| 6 | عکس فاکتور، ثبت خودکار | روند گرانی هر جنس را نشان می‌دهد |
| 7 | محتوای اینستاگرام از منوی خودت | کپشن و پست هفتگی |
| 8 | پاسخ خودکار دایرکت و رزرو | به پیام‌های تکراری خودش جواب می‌دهد |
| 9 | مقایسهٔ بی‌نام با کافه‌های رشت | کجای بازار ایستاده‌ای، بدون اینکه کسی اسمت را ببیند |
| 10 | باشگاه مشتری روی موبایل | می‌فهمی کدام مشتری برنگشته |
| 11 | ساعت‌های زیان‌ده | کدام ساعت‌ها خرجشان از درآمدشان بیشتر است |
| 12 | چک‌لیست روزانهٔ کارکنان | باز و بست، دما، تمیزکاری |
| 13 | دستیاری که فارسی جواب می‌دهد | «ماه پیش چای بیشتر فروش رفت یا قهوه؟» |

### 3.6 CBC attributes and levels

Six attributes. Level indices are fixed and must match `cbc_design.json`.

**How the fourteen concepts map onto the six attributes.** The MaxDiff ranks concepts;
the conjoint prices *shapes of product*. Keep this mapping current — a concept with no
home in the conjoint is a concept you can rank but cannot price, which is exactly the
gap that put the assistant into `delivery` above.

| Conjoint level | MaxDiff concepts it covers |
|---|---|
| `job 0` قیمت و سود | 1 هشدار قیمت تمام‌شده · 2 منوی سودده · 11 ساعت‌های زیان‌ده |
| `job 1` سفارش و انبار | 4 پیشنهاد سفارش · 5 ثبت ضایعات · 6 عکس فاکتور |
| `job 2` شیفت و نیرو | 3 پیش‌بینی شلوغی · 12 چک‌لیست روزانه |
| `job 3` مشتری و اینستاگرام | 7 محتوای اینستاگرام · 8 پاسخ خودکار · 10 باشگاه مشتری |
| `job 4` مقایسه | 9 مقایسهٔ بی‌نام |
| `delivery 0` برگهٔ کاغذی | 0 برگهٔ ماهانه |
| `delivery 3` دستیار فارسی | 13 دستیاری که فارسی جواب می‌دهد |

All fourteen now have a home. Two of them (0 and 13) sit under `delivery` rather than
`job`, because they were never jobs — they are ways the answer arrives.

**3.6.1 `job` — کار اصلی (5)**
`0` قیمت و سود آیتم‌ها · `1` سفارش و انبار · `2` شیفت و نیرو ·
`3` مشتری و اینستاگرام · `4` مقایسه با کافه‌های دیگر رشت

**3.6.2 `input` — داده چطور وارد می‌شود (4)**
`0` خودکار از صندوق فروش · `1` عکس گرفتن از فاکتور ·
`2` پنج دقیقه در روز، دستی · `3` ما ماهی یک بار می‌آییم و وارد می‌کنیم

**3.6.3 `delivery` — جواب چطور می‌رسد (4)**
`0` برگهٔ کاغذی ماهانه · `1` پیام واتساپ هفتگی · `2` اپ روی موبایل ·
`3` دستیار فارسی — هر وقت خواستی می‌پرسی

Level `3` was «جلسهٔ حضوری ماهانه» until 12 September 2026. Two reasons it changed,
and **no design file was touched** — the JSON stores the integer `3`, so what `3`
*means* is defined here and nowhere else:

1. The conversational assistant (MaxDiff item 13) is a *channel*, not a job, and had
   no level anywhere in the conjoint. If it had ranked well in MaxDiff there would have
   been no priced package to sell against it.
2. `delivery 3` and `input 3` («ما ماهی یک بار می‌آییم و وارد می‌کنیم») described the
   same monthly visit. Roughly a sixteenth of all packages therefore proposed *two*
   separate visits to one café — implausible on the card, and a waste of design space on
   a distinction that is not real. The in-person channel is not lost; it lives on as
   `input 3`, where a person comes and does the data entry.

**3.6.4 `who` — تصمیم با کیه (3)**
`0` خودش تصمیم می‌گیره و بهت می‌گه · `1` پیشنهاد می‌ده، تصمیم با خودته ·
`2` یه آدم باهات مرور می‌کنه

This attribute asked **چه کسی کار را می‌کند** — who does the work — until 12 September 2026.
It now asks who makes the *decision*. **No design file was touched**; only the meaning of
levels `0/1/2` changed, and that meaning lives here.

Why it had to change: `input` already answers who does the work. "خودکار از صندوق فروش"
is a machine; "ما ماهی یک بار می‌آییم و وارد می‌کنیم" is a person. So the old `who` was
re-asking a question `input` had settled — and worse, the two could disagree. A package
reading «پنج دقیقه در روز، دستی» *and* «همه‌چیز خودکار» is nonsense. Measured on the shipped
design: **97 of 600 alternatives were incoherent, and because one bad card spoils a whole
screen, 96 of the 200 choice tasks contained at least one.** Just under half of every
owner's choice tasks showed them a package that could not exist.

Pointed at the decision instead, all twelve `input` × `who` combinations are coherent —
you can type your own numbers into a system that then decides for you, or have us enter
them and still make every call yourself. And it now measures automation trust, which is
the open question the paper instrument's whole I1–I5 section was circling and which
nothing else here reaches.

The attribute id stays `who` because the design JSON and the analysis code key on it.

**3.6.5 `commit` — تعهد (3)**
`0` بدون قرارداد، هر ماه می‌توانی قطع کنی · `1` سه‌ماهه · `2` یک‌ساله

**3.6.6 `price` — قیمت ماهانه (5)**
Multiples of the café's own reference item: `0` ×3 · `1` ×6 · `2` ×10 · `3` ×16 · `4` ×25

Render as `round(multiplier × price_ref_toman, -4)` toman, with
«به اندازهٔ N تا قهوه در ماه» beneath in small type.

**Why the coffee and not the barista shift.** The ladder was denominated in barista shifts
until 12 September 2026 — ×1 to ×8 of what one shift cost, which the owner supplied. Three
problems, in rising order of seriousness:

1. It required a wage question, which contradicted §0.6 and could be refused, and module 4
   could not run without it. A mandatory money question inside a promise not to ask one.
2. Café owners do not hold a per-shift figure in their heads; they know a monthly salary.
   Asking per-shift forced arithmetic at the tablet, which produces round numbers and noise.
3. Before that it ran ×0.5 to ×5, and nobody works or hires half a shift, so two of the
   five levels were phrased in a unit that does not exist.

The reference item is on the menu. Nobody is asked anything, so the failure mode is gone.
It inflates with everything else, so the axis still does not rot. And it is the arithmetic
a café owner already does every day: *how many more coffees must I sell to cover this.*

**What it costs.** The shift denominator scaled with café size — a bigger payroll meant
proportionally bigger prices on the card. Coffee prices vary far less between a twelve-seat
kiosk and a sixty-seat café-restaurant, so that scaling is lost. Recover it by segmenting
on `seats`, `staff` and `competitors_2min` from the observation block, which §10 already
prefers to latent classes at this sample size. The compensation is that WTP now converts
almost directly into a toman price you can actually charge, instead of a per-café figure
you must convert back.

**[PILOT] The multipliers are provisional.** `[3, 6, 10, 16, 25]` brackets a plausible
range, but only the pilot can say where owners actually flip. Changing them is free before
fielding and forbidden after — see the warning below.

**[STATS] The ladder is part of `design_version`.** The session stores the level *index*.
If one batch renders index 4 as ×25 and another as ×40, index 4 means two different prices
and the batches cannot be pooled — the same failure as shipping two design files. Write the
active `PRICE_MULT` into every session (§5) and refuse to pool sessions that disagree.

## 4. The design files

### `design/maxdiff_design.json`
```
meta.versions = 6, sets_per_version = 12, set_size = 4, n_items = 14
versions[v][s] = [i, i, i, i]      // item indices
```
Verified balance: each item appears 19–23 times across all six versions (target 20.6);
pairwise co-occurrence ranges 1–6, mean 4.75.

### `design/cbc_design.json`
```
meta.attributes = [{id, n_levels} ...]   // order defines profile array order
versions[v][t][a] = [job, input, delivery, who, commit, price]   // level indices
holdouts[h][a]   = [...]   // 2 tasks, shown to everyone, excluded from estimation
traps[t][a]      = [...]   // 2 tasks; in each, one alternative is another but
                           // pricier and longer-committed, i.e. strictly dominated.
                           // The dominated alternative sits at a DIFFERENT index in
                           // each trap, so always tapping one card cannot pass both.
```
Verified: 20 versions × 10 tasks × 3 alternatives, 18 effects-coded parameters,
D-error 0.325 against 0.867 for an equivalent random design (**167 % better**),
maximum absolute between-attribute correlation 0.051, level frequencies within
±4 % of target on every attribute.

**[STATS]** Assign `cbc_version = hash(session_id) % 20`, record it, and never modify the
profiles. To change attributes or levels, edit `generate_designs.py`, re-run it with
`--force`, and bump `design_version` — do not hand-edit the JSON.

**[STATS] The same seed does not guarantee the same design.** Both optimisers are
hill-climbers that accept a move on `<=` against a floating-point objective
(incrementally-updated variances; `slogdet` through LAPACK). Near-ties break differently
across platforms and BLAS builds. Measured: regenerating the shipped design on Windows
produced D-error 0.32494 and max attribute correlation 0.0577, against the shipped
0.32485 / 0.0512 — a different design, from the same seed and the same code.

This is harmless while the shipped JSON is the only source of truth, and silently
corrupting if it is not: `cbc_version` is an *index*, so two tablets carrying different
files would record the same index against different profiles, and the pooled data would
be wrong in a way no diagnostic catches. Therefore:

- Both files carry `meta.content_sha256` over their content (the `meta` block excluded).
- `python generate_designs.py --verify` checks the shipped files against those hashes.
  **Run it before every field day** and before every analysis batch.
- Bare `python generate_designs.py` now refuses to overwrite existing files. Regenerating
  is deliberate: `--force`, and it bumps `design_version`.
- Ship both files to every tablet together. Never mix `design_version`s in one batch.

### Sample size

Johnson–Orme's rule for main effects, `n ≥ 500·c / (t·a)` with `c = 5` levels,
`t = 10` tasks, `a = 3` alternatives, gives **83 respondents**. Ten tasks rather than
eight is exactly what brings this within reach of the 80-café target; at eight tasks it
would be 104.

**That floor is about precision, not validity.** Measured on this design, sd 0.25, ten
replicates per row:

| cafés | observations | utility correlation | WTP error | picks the right best level |
|---|---|---|---|---|
| 25 | 250 | 0.954 | ±0.78 shifts | 93 % |
| 40 | 400 | 0.971 | ±0.43 shifts | 97 % |
| 60 | 600 | 0.983 | ±0.33 shifts | 97 % |
| **83** | 830 | 0.987 | ±0.31 shifts | 95 % |
| 120 | 1200 | 0.990 | ±0.29 shifts | 95 % |
| 200 | 2000 | 0.995 | ±0.20 shifts | 98 % |

The *ranking* is remarkably stable all the way down — 40 cafés already recovers the best
level of each attribute 97 % of the time. What degrades is WTP as a quantity. Below about
40 cafés the ±0.78 error exceeds the entire spread of `delivery` or `who`, so WTP stops
carrying information while the ranking is still sound.

**Read it as three bands:**

- **Under 40 cafés** — MaxDiff counting scores are the headline. Quote conjoint *direction*
  only: which level of each attribute wins. Never quote a price.
- **40 to 80** — conjoint ranking and attribute importance are trustworthy. WTP is
  directional, ±0.4 shifts; quote it as a band and never to a decimal place.
- **80 and up** — WTP is quotable as a range. It tightens slowly after that: you would need
  roughly 200 cafés to halve the error, which is almost certainly not worth the fieldwork.

This means a genuine readout is possible at **40 cafés**, roughly half the target, rather
than waiting for 83 before anything can be said. Plan the analysis in two passes.

## 5. Data model

One JSON document per session. Local-first in IndexedDB (Dexie), exported as a file.

```jsonc
{
  "schema": 1,
  "session_id": "uuid-v4",
  "design_version": "2026-09-12",
  "price_mult": [3, 6, 10, 16, 25],     // [STATS] the ladder this session saw
  "started_at": "ISO-8601", "finished_at": "ISO-8601",
  "interviewer": "KM", "device": "tab-01",
  "consent": { "analysis": true, "named": false },

  "profile": {
    "years": 4, "branches": "یک", "staff_ft": 2, "staff_pt": 2, "shifts": "دو",
    "type": "قهوه‌محور", "seats": 26, "pos": "صندوق ساده",
    "price_ref_item": "espresso", "price_ref_toman": 95000   // from pre-flight, off the menu
  },

  "maxdiff": {
    "version": 3,
    "responses": [ { "set": 0, "items": [2,7,9,13], "best": 9, "worst": 7,
                     "latency_ms": 3412 } ]
  },

  "coins": { "job_0": 4, "job_1": 3, "job_2": 0, "job_3": 1, "job_4": 2 },

  "cbc": {
    "version": 11,
    "responses": [ { "task": 0, "kind": "design",              // design | holdout | trap
                     "position": 3,                            // where it appeared
                     "profiles": [[0,1,2,0,1,3],[...],[...]],
                     "chosen": 1, "would_buy": true,
                     "latency_ms": 5210 } ]
  },

  "open": { "audio_ref": "blob-id", "duration_s": 31, "text": null },

  "close": { "referrals": ["کافهٔ روبرو — آقای ک."], "allow_pos_data": "باید فکر کنم",
             "pilot_willing": true },

  "observation": { "seats": 26, "occupancy": 11, "at_hour": "17:30",
                   "price_espresso": 95000, "menu_items": 34, "hours_open": 12.5,
                   "menu_type": "چاپی", "pos_seen": false,
                   "order_taking": "روی کاغذ نوشت", "location": "فرعی",
                   "signage": "متوسط", "competitors_2min": 4, "wifi": true,
                   "outlets": false, "queue": "کوتاه",
                   "instagram": "cafe_x", "followers": 3400 },

  "quality": {
    "median_latency_ms": 4100, "fast_tasks": 0, "trap_failed": false,
    "straightlined": false, "holdout_consistent": null, "completed": true
  }
}
```

Export: a single `.json` per session plus a combined `.csv` of flat rows, written to the
tablet's Downloads via the File System Access API with a `<a download>` fallback. **A
session is only marked `exported` once the file write resolves.**

---

## 6. Quality instrumentation

Compute on device, store in `quality`, never show to the player.

- `latency_ms` on every MaxDiff and CBC screen. Flag `fast_tasks` where `< 2000 ms`.
- `trap_failed` — true if the dominated alternative was chosen in *either* trap task,
  determined by profile comparison, not index (§2.4).
- `straightlined` — true if the same card *position* was chosen in ≥ 8 of 10 CBC tasks.
- `holdout_consistent` — left null on device; the analysis repo fills it from model fit.
- `completed` — reached module 6.

### What the trap is actually worth

Measured, not assumed. A dominance trap catches a respondent who clicks at random
**1 time in `n_alternatives`** — 33 % with three cards — no matter how obvious the
dominated option is. Two traps take that to 56 %, three to 70 %. Two is where the eight
seconds stops paying.

It also **flags about 12 % of careful respondents**, because a real respondent's logit
noise occasionally lands on the dominated card. That is not a defect; it is what a
stochastic respondent does.

**[STATS] So a failed trap is not on its own grounds for exclusion.** At a realistic 5 %
carelessness rate, excluding on the trap alone would discard roughly nine good cafés to
remove two bad ones — a losing trade when a café costs an hour of fieldwork and cannot be
asked twice. Earlier versions of `analyse.py` did exactly that, contradicting this
section's own instruction.

### The exclusion rule

`analyse.py: usable()` drops a session only when:

| Rule | Why |
|---|---|
| consent withheld | not ours to analyse |
| incomplete | never reached module 6 |
| straight-lined | same position in ≥ 8 of 10 tasks |
| `fast_tasks ≥ 5` | nobody reads three six-attribute packages in under two seconds |
| `trap_failed` **and** `fast_tasks ≥ 2` | the trap, corroborated by speed |

A failed trap *without* speed is **kept**, and listed in `quality_report.txt` as worth an
eyeball. Measured on 90 simulated cafés with 13 planted random-clickers: the screen caught
**13 of 13** and wrongly dropped **1 careful café** (1.3 %).

Speed is the load-bearing signal here, not the trap. The trap's value is that it catches a
careless respondent who is *also slow* — someone filling it in wrong on purpose — which
speed alone never sees.

**[STATS]** Export everything regardless. Report every drop and why.

## 7. Gamification: what is allowed

**Allowed, and wanted**
Progress as a filling café card rather than a bar · fast tactile transitions with
haptics · a satisfying snap when a coin lands · the reveal animation · sound effects,
**off by default** · warm illustrated icons for each concept · a printed/shared card
image at the end.

**Forbidden**
- Points, scores, XP, stars, badges, streaks, or any leaderboard.
- Any countdown, stopwatch, or "you were faster than X%" feedback.
- Any feedback implying an answer was right, good, smart, or popular.
- Showing other cafés' individual answers at any point before the reveal.
- Randomising set composition, set order, or attribute order at runtime.
- Skip buttons on modules 1–5, or any path that reaches the reveal early.
- Autoplay sound, confetti on selection, or anything that rewards a particular choice.

The test: *would this feature change which package a rational owner picks?* If yes, it
is not gamification, it is bias.

---

## 8. Technical

- **Stack** Vite + React 18 + TypeScript. Zustand for session state. Dexie over
  IndexedDB. GSAP for choreographed transitions; CSS for immediate control feedback.
  No UI kit — the design language is small. Research alternatives must always receive
  equal motion treatment; see `DESIGN.md`.
- **PWA** Workbox service worker, `display: fullscreen`, installable, full offline. All
  assets precached. Verify with DevTools offline mode as an acceptance test.
- **Fonts** Vazirmatn, self-hosted as woff2 in `public/fonts`. **No CDN** — the app must
  work with no network, and Google Fonts is unreachable from Iran regardless.
- **RTL** `dir="rtl"` on `<html>`, logical CSS properties throughout
  (`margin-inline-start`, not `margin-left`). Persian digits for display via
  `Intl.NumberFormat('fa-IR')`; store raw numbers.
- **Touch** minimum target 56 × 56 px; primary actions in the lower half of the screen;
  design for a 10" tablet held in two hands, and for a 45-year-old's eyes — base type
  18 px, never below 15 px.
- **State** every answer persisted immediately; a crash or a dead battery must resume at
  the same screen. Test by killing the app mid-CBC.
- **Sync** none required. Export by file. If you add a sync target later it must be
  self-hosted and strictly optional — never put the fieldwork on a critical path
  through a service you do not control.
- **Locale** `fa-IR`; Jalali dates via `Intl.DateTimeFormat('fa-IR-u-ca-persian')`.

### Repository layout
```
/design      generate_designs.py, maxdiff_design.json, cbc_design.json, benchmarks.json
/src
  /modules   00-open 01-profile 02-maxdiff 03-coins 04-cbc 05-voice 06-reveal 07-observe
  /core      session store, dexie schema, design loader, export
  /ui        Card, Chip, Stepper, CoinTray, ProgressCafe
/analysis    see §10 — separate Python project, reads exported sessions
```

### Build order
1. Shell, routing, Dexie, session lifecycle, export. Prove a fake session round-trips.
2. Module 4 (CBC) first — it is the hardest and the whole study depends on it.
3. Module 2 (MaxDiff), then 1, 3, 5.
4. Module 6 reveal against a stubbed `benchmarks.json`.
5. Module 7, PIN gate, quality flags.
6. Offline acceptance pass, then a pilot on five cafés before touching the real sample.

**Pilot gate:** run five sessions, check median completion time is under 12 minutes and
no trap failures, then stop and review the data before scaling. Fix the instrument on
five cafés, not eighty.

---

## 9. Accessibility and field realities

- One-handed operation while the owner holds a phone in the other hand.
- Assume interruptions: a customer arrives mid-session. A "pause" that locks the screen
  and resumes exactly is worth more than any animation.
- Glare: high contrast, no thin light-grey text; test outdoors.
- Some owners will hand the tablet to a younger employee. Record who actually played in
  `interviewer`-adjacent field `played_by` (مالک / مدیر / کارمند) — it changes how you
  read the answers.

---

## 10. Analysis handoff

Separate Python project in `/analysis`, reading the exported session files.

- **MaxDiff** — counting scores first (best − worst, normalised by appearances), then a
  rank-ordered logit for part-worths. Counting is what you show; the model is what you
  check it against.
- **CBC** — conditional logit (effects-coded) on the design tasks only. Fit on
  `chosen`; use `would_buy` for a separate binary take-rate model. Validate on the two
  holdout tasks and report hit rate.
- **Willingness to pay** — reported in coffees per month, and computed in a way that two
  obvious shortcuts get wrong.

  **Against a fixed reference level, declared a priori.** `analyse.py: REFERENCE` names the
  least attractive version of each attribute we would actually ship — `job` 4 (benchmark
  only), `input` 2 (five manual minutes a day), `delivery` 0 (monthly paper), `who` 0
  (nobody checks it), `commit` 2 (one-year lock-in). Never take the baseline to be
  "whichever level estimated lowest": where two levels are close the estimated minimum
  flips between runs and every WTP in that attribute moves with it. Measured on simulated
  data, the estimated-minimum level for `job` landed on the true minimum in only 2 of 8
  replicates.

  **Off the price curve, not off a slope.** The five price levels are unevenly spaced
  (×3, ×6, ×10, ×16, ×25) and price response is concave, so a single linear slope through
  them over- or under-states every level by 30–56 %. WTP is instead read by inverting the
  piecewise-linear price-utility curve, anchored at the cheapest rung, which is where the
  headroom is needed once every reference level is the least attractive one.

  **Levels can price out past the ladder.** Where a level is worth more than the ladder
  can express, `wtp.csv` marks `extrapolated = true`. Those numbers extrapolate along
  a *flattening* curve and are wildly overstated — read them as "worth more than five
  shifts", never as the printed figure. If more than a quarter of levels extrapolate, the
  ladder is too narrow for this population and must be re-set before the next batch;
  `analyse.py` says so in `quality_report.txt`.

  **Quote importance alongside every WTP table.** `attribute_importance.csv` gives each
  attribute's utility range as a share of the total. It needs no baseline and no price
  curve, so it is stable exactly where WTP is fragile. WTP recovers to within about 6 % of the ladder span
  on 90 simulated cafés — good enough to rank and to size a price, not to quote to two
  decimal places.

- **Take-rate** — a binary logit on the dual-response `would_buy` follow-up
  (`take_rate.csv`). Without it there is no take-rate estimate at all: the conditional
  logit only says which of three packages wins a forced choice, never whether any of them
  would be bought. Recovered within 4 points of the planted rate on simulated data.

- **Coins** — `coins.csv` summarises module 3: mean coins per job, the share of owners
  giving a job nothing, and the share giving it four or more. Intensity, which a ranking
  cannot show.

- **benchmarks.json** — regenerate after each batch: percentiles for price, menu size,
  seats, staff, hours. This file feeds module 6, closing the loop that makes the whole
  thing recruit itself.

---

## 11. Verification

`analysis/simulate_and_verify.py` plants a known set of preferences, simulates 90 sessions
against the shipped designs, runs the real analysis pipeline over them, and checks what
comes back. It is the acceptance test for §10 — run it after any change to the designs or
the estimator, and read the result rather than this table.

```bash
cd analysis && python simulate_and_verify.py     # must end ACCEPTANCE: PASS
```

Fifteen checks, all asserted (earlier revisions printed several of these but gated the
verdict on only three, so a regression in the holdouts, the trap, WTP or the take-rate
would have passed silently):

| Check | Result |
|---|---|
| CBC utilities, correlation with planted truth | 0.99 |
| MaxDiff B-W score, correlation with truth | 0.997 |
| MaxDiff top-3 items recovered | 3 / 3 |
| Holdout hit rate | 93.4 % (chance 33.3 %) |
| Trap flags exactly those who chose a dominated alternative | yes |
| Trap detection of random-clickers | 62 % (two traps; theory 56 %) |
| Quality screen: careless caught | 13 / 13 |
| Quality screen: careful cafés wrongly dropped | 1 of 77 (1.3 %) |
| Take-rate | 58.2 % observed vs 54.0 % planted |
| WTP, mean absolute error inside the ladder | 1.28 coffees/month (5.8 % of the ×3–×25 span) |
| WTP, correlation with truth | 0.945 |
| Levels pricing out past the ladder | 2 / 19 (11 %) |
| Price curve monotone within standard error | yes |
| Estimator convergence | max abs gradient 1e-6; identical to Newton–Raphson MLE |
| Shrinkage at identical respondents | slope 1.02 |

Design quality, from `design/generate_designs.py` (shipped files, `--verify` OK):

| Check | Result |
|---|---|
| CBC D-error vs equivalent random design | 0.325 vs 0.867 — 2.7× better |
| Max absolute between-attribute correlation | 0.051 |
| Level frequency deviation from target | within ±4 % on all six attributes |
| MaxDiff item appearances across versions | 19–23 (target 20.6) |
| MaxDiff pairwise co-occurrence | 1–6, mean 4.75 |
| Every item shown in every version | yes, 3–4 times each |
| Dominated alternatives in the 200 design tasks | 0 |
| Duplicate tasks | 0 |
| Versions missing a price or job level | 0 / 20 |

### Known limits, measured rather than assumed

1. **WTP recovers to within about 6 % of the price ladder span at n = 90.** Fine for ranking and for sizing a price band;
   not a figure to quote precisely. Report `attribute_importance.csv` beside it.
2. **11 % of levels price out past the ladder** under the planted preferences. Whether that
   happens in the field depends on real price sensitivity, which is unknown until the
   pilot. Check `quality_report.txt` after the first batch and widen the top multiplier if
   the extrapolation rate exceeds a quarter.
3. **The planted truth is an assumption, not data.** Every number above is conditional on
   it. The acceptance test proves the *pipeline* recovers what was put in; it cannot prove
   the attribute set is the right one. Only the pilot and the open question can.
4. **The design is not bit-reproducible.** See §4. The shipped JSON is the artefact of
   record; verify its hash, never regenerate casually.

## 12. Open decisions

Record the answers in `DECISIONS.md` as they are made.

*Closed 12 September 2026 — what happens if owners refuse the wage question. There is no
wage question. The denominator is read off the menu (§3.6.6), so it cannot be refused.*

- App name and logo (قهوه‌سنج is a placeholder).
- Whether the reveal card image includes your contact details (it should).
- Whether to offer the owner a printed copy on the spot — worth testing, it is a
  strong reciprocity trigger.
- Arabic-script numeral preference: `۱۲۳` throughout, or Latin for prices only.
