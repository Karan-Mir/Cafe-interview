# Qahvesanj interface system

## Product character

Calm, trustworthy and tactile: warm paper, glazed sage ceramic and restrained brass.
The product is a field-research instrument for busy café owners, not a marketing site.
Beauty must reduce effort without changing which research alternative attracts attention.

## Users and conditions

- Persian RTL, usually on a 10-inch tablet; phones are supported in both orientations.
- One-handed use, interruptions, outdoor glare and unreliable connectivity are normal.
- Base text is 18px. Interactive targets are 56px by default and never below 44px.
- Every critical flow and asset works offline.

## Tokens

- Paper `#f4f0e7`; surface `#fffdf8`; secondary surface `#ebe8de`.
- Ink `#233b32`; muted ink `#526057`; faint readable ink `#59665d`.
- Moss `#244d3d`; soft moss `#e5ede2`; brass `#a77b3e`.
- Radii: 12px controls, 18px panels, 24px feature cards.
- Spacing: .35rem, .6rem, 1rem, 1.4rem, 2rem.
- Motion: 160ms state, 220ms UI, 420ms screen; primary ease `cubic-bezier(.22,1,.36,1)`.

## Typography

Use the bundled Vazirmatn family at weights 400, 600 and 700. Do not add a remote font.
Headings use weight and scale, not artificial letter spacing. Instructions stay conversational,
short and specific. Helper copy must describe the next action or consequence.

## Components

- Primary button: one per decision region, dark moss, strongest local emphasis.
- Ghost button: secondary or reversible action.
- Chips: compact mutually exclusive values with `aria-pressed` state.
- Fields: group related controls; avoid nested cards and decorative containers.
- Research alternatives: identical size, artwork treatment, elevation and animation.
- Dialogs: labelled modal semantics, contained focus and restored focus.

## Motion rules

GSAP owns choreographed sequences: welcome sculpture, coin allocation and result reveal.
CSS owns immediate control feedback and the recording waveform. Animate transform and opacity.
Never stagger research alternatives, celebrate an answer, or animate a choice more strongly than
its peers. `prefers-reduced-motion: reduce` removes all non-essential movement.

## Responsive rules

- MaxDiff remains a four-way 2x2 comparison on common phone widths.
- CBC uses a three-column comparison deck with separate feature bands in phone portrait and equal cards elsewhere.
- Under 340px, ask for landscape rather than presenting an unreadable comparison.
- Artwork never sits in front of copy and all flex/grid children permit shrinking.

## Accessibility and content

Normal text targets WCAG AA contrast. Selected states use text/icon plus color. Disabled actions
have nearby instructions explaining what remains. Status, errors and recording state are announced.
All visible participant copy is Persian and spoken rather than bureaucratic.
