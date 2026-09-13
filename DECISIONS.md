# Interface revision — September 12, 2026

The user requested a full usability, Persian copy, and visual refinement, while retaining the existing survey and avoiding additional pages.

- Replaced the ambiguous MaxDiff tap/double-tap and immediate advance with explicit best/worst buttons and confirmation. The 12 fixed sets, their order, item IDs, and response shape are unchanged. This deliberately supersedes the original automatic-advance interaction in SPEC 2.2. Response latency now includes reviewing and confirming these selections; do not compare timing directly with the previous interaction.
- Profile quantities can be typed as well as adjusted. Explicit zero choices unblock new cafés, cafés without full-time staff, and cafés without seating. Seats increment by one rather than two.
- CBC alternatives retain equal styling, fixed profiles, and existing presentation order. Attribute labels and neutral package numbers support comparison. Latency is captured at the first package selection, as requested by SPEC 2.4, rather than after the purchase follow-up. Saved response fields and design files are unchanged.
- Pilot interest uses the existing true/false/null values for yes/no/undecided. This fixes the former simultaneous selection of maybe and no without adding a data field.
- The comparison screen reads actual observations for menu size and opening hours, labels missing values, and does not display empty chart tracks as results. The shipped empty benchmark dataset remains intact; synthetic analysis data has not been promoted to field benchmarks.
- Added voice playback, visible save/error states, elapsed-time tracking, and controls that prevent leaving or switching input mode mid-recording. Audio remains local; the export mechanism is unchanged.
- Added five bundled SVG illustrations (café, choices, coins, microphone, report), unified typography and form surfaces, and reduced-motion support. Illustrations do not differ between research alternatives.
- Screen changes reset scroll to the instructions. The final screen provides an explicit, PIN-gated observation entry button in addition to the existing long-press shortcut.

Verification: production TypeScript/Vite/PWA build; browser walkthrough covering setup, all four profile steps, all 12 MaxDiff sets, ten-coin allocation, all 14 CBC tasks, text response, benchmark empty state, and mutually exclusive pilot choices. QA session is labeled ui-review-test and analysis consent is disabled. Physical microphone capture requires a device check; no microphone permission was granted during automated QA.

## Design-system and motion revision — September 13, 2026

- Added `DESIGN.md` as the visual and interaction contract. Consolidated the active palette into one token source and raised low-contrast secondary colors.
- MaxDiff retains all fixed items and response logic but uses a compact 2x2 phone comparison. CBC retains the fixed profiles, position randomisation and stored indices but uses a neutral three-column matrix in phone portrait. Exceptionally narrow screens request landscape.
- GSAP replaces the unused Framer Motion dependency for the welcome sculpture, coin feedback and reveal choreography. Research alternatives never receive staggered or unequal motion; CSS remains responsible for immediate control feedback.
- Full-screen interruption, PIN, archive and resume surfaces now use labelled modal semantics, focus containment and focus restoration. Disabled next actions explain what information remains.
- Replaced the spreadsheet-like portrait CBC matrix with a rounded comparison deck. Each attribute is now a separate visual band with equal package columns, a distinct price band and compact selection controls. The fixed profiles, column order, first-tap latency and stored choice index are unchanged.
- Replaced the shared CBC comparison deck with three self-contained bundle panels so each alternative reads as a complete offer. Every panel has its own professionally generated still life, with equal framing, palette, size and visual weight to avoid signalling a preferred package. The fixed randomized profiles, displayed order, first-tap latency and stored choice index remain unchanged.
- Added explicit return paths from the final questions and completed-session screens. Returning from completion preserves the locally saved session and uses the existing completion/sync path when the interviewer finishes again.
- Normalized MaxDiff card and choice-control geometry: cards stretch to the same row height, desktop actions use fixed equal columns, phone actions use a consistent vertical stack, and pressing a nested control no longer scales its parent card out of alignment.
- Reserved a dedicated grid column for each MaxDiff arrow badge so Persian action labels wrap within their own column instead of colliding with the icon at tighter widths.
