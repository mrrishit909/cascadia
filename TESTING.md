# Testing

Current counts (full suite, last verified fresh before this document was written): **61/61 Vitest,
123/123 Playwright per engine (369 across Chromium/Firefox/WebKit), 32/32 pytest**, clean production build. Every number in this document is
reproducible by actually running the commands below -- none of it is asserted without having just run
it.

**2026-10-11 update (CI hardening):** Playwright now has Chromium, Firefox and WebKit projects
(`--project=<name>`); the suite is 123 tests per engine, 369 in all, and CI runs each engine as its
own job (all 123/123 on Linux, run 38123008389). Two tests were made engine-independent after
Firefox/WebKit exposed timing assumptions (not app bugs): Compare's isolation test now checks the
removal back on chapter 4 (the Compare click scrolls the shared stage to chapter 5), and the D1
debounce test stages the capacity keystroke last so the 250ms debounce always elapses after Apply.
Local macOS caveat: Playwright's WebKit on macOS does not Tab to buttons (an OS keyboard-navigation
setting), so `cas_substation_remove_keyboard.spec.ts` skips in WebKit on macOS only; Linux CI runs it
in all three engines. Its evidence screenshot is written to `verification/SCREENSHOTS/` by Chromium
only (other engines write to `test-results/`). Use `PW_PORT=<port>` to run the preview on a port other than 4173.

## Why three suites

- **pytest** (`.venv/bin/python -m pytest -q`): the Python oracle itself (`research/models/oracle.py`)
  and its own direct tests -- the independent ground truth every other parity check compares against.
- **Vitest** (`npm run test`): component/unit tests (jsdom), plus the TS-vs-Python analytical parity
  tests (`tests/unit/*.test.ts`) that run the REAL browser-side solver logic against the oracle's own
  fixtures.
- **Playwright** (`npm run test:e2e`): real-browser, real production build, real Web Worker, real WASM
  solver -- never mocked. The project's standing rule: `playwright.config.ts`'s `webServer` always
  builds fresh and refuses to reuse a stale server (`reuseExistingServer: false`), specifically because
  an earlier development session found a stale preview process silently serving old code produced a
  false pass.

## Playwright spec breakdown

| File | What it covers |
|---|---|
| `cas_substation_remove_keyboard.spec.ts`, `addLine.spec.ts`, `compareRestoration.spec.ts`, `newControls.spec.ts` | Each of the 7 controls: keyboard-only operation, real solver results, N1/D1/D2-class race and reset regressions. |
| `concurrency.spec.ts` | Cross-control races under real and artificially-delayed WASM load: overlapping solves, reset-during-solve, debounce-window ordering. |
| `dualMount.spec.ts` | Home/lab placement synchronization and singleton Worker ownership. |
| `touch.spec.ts` | Real touch-emulated interaction (`.tap()`, not `.click()`) at the mobile breakpoint. |
| `networkRovingTabindex.spec.ts` | Keyboard roving-tabindex navigation on the network SVG itself. |
| `a11y.spec.ts` | axe-core zero-violations checks (baseline + each chapter with new interactive content), live-region announcement counting. |
| `introMotion.spec.ts`, `chapterTitle.spec.ts` | The intro's 4 beats, Skip Intro, chrome reveal, and the shared masked-title-reveal primitive used by all 6 chapters. |
| `chapter1.spec.ts` ... `chapter6.spec.ts` | Per-chapter: entry, reverse scroll, instant FIG-index jump, an interrupted transition, reduced motion, analytical-state preservation (no stray solver Worker from scrolling alone), and a chapter-specific regression for whatever that chapter's own review found (chapter 3's mid-morph live-control-change scenario; chapter 4's collapse-to-origin fix; chapter 6's concurrent-solve-during-feedback scenario). |

## Reproducing the visual evidence

Real screenshots (never `fullPage: true` for a scrolled chapter state -- `ARCHITECTURE.md`/
`execution/PROGRESS.md` document why that specific flag produces misleading evidence for a
`position: sticky` stage) live in `verification/SCREENSHOTS/`, one set per chapter per required
breakpoint (1440x900, 768x1024, 390x844) plus a reduced-motion variant. Each was captured by scrolling a
real headless-Chromium page to the chapter's actual scroll position, waiting for the relevant motion to
settle, and reading the resulting image before calling that chapter done -- the project's own mandatory
visual-QA rule, which caught real defects (a hidden-stage background bug, a locator-inset/title layout
collision, a chapter-4/2 content-position mirror-image bug) that no assertion-based test found.

## Performance evidence

`verification/PERFORMANCE/`:

- `CH3_FRAMEPACING_REPORT.md` -- chapter 3's own isolated corridor-morph measurement.
- `FULL_SUITE_FRAMEPACING_REPORT.md` -- the integrated, whole-experience measurement (forward/reverse
  scroll, rapid navigation, every chapter's heaviest interaction, a live solver update firing during
  motion), with an idle-baseline AND an `about:blank` control proving which numbers reflect real
  application cost vs. this environment's own measurement floor.

## Reproducing everything

```bash
npx tsc --noEmit
npm run test
npm run build && npm run test:e2e
.venv/bin/python -m pytest -q
```

## What's deliberately NOT covered

See `LIMITATIONS.md` for the full list. Testing-specific gaps: a true slider-DRAG gesture is not
simulable via Playwright's `.tap()` (confirmed directly, not assumed -- documented in
`specifications/REQUIREMENTS.yaml`'s CAS-UX-001 note); a native `<select>`'s value does not respond to
synthetic `ArrowDown`/typeahead key events in headless Chromium (a Playwright/browser-automation
limitation, not an app accessibility gap -- `selectOption` is used for those elements instead, every
other interactive element uses real keyboard events).
