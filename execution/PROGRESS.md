# Progress

Last updated manually, 2026-10-09 (architecture-stabilization phase complete; chapter scaffolding next).

## State: M4 functional/analytical + visual-foundation + architecture-stabilization phases COMPLETE

All 7 required interactions (CAS-INT-001 through CAS-INT-007) are implemented and each independently
adversarially reviewed, with no P0/P1 defects found anywhere:

- CAS-INT-001 (remove substation), CAS-INT-005 (alter line capacity): `verification/D1_D2_INDEPENDENT_REVIEW.md`
- CAS-INT-002 (increase load), CAS-INT-003 (reduce generator), CAS-INT-007 (line outage): `verification/M4_WAVE1_INDEPENDENT_REVIEW.md`
- CAS-INT-004 (add line), CAS-INT-006 (compare restoration): `verification/M4_INT004_006_INDEPENDENT_REVIEW.md`

Two known pre-existing P2s remain open and tracked (not release-blocking, not touched yet):
- AlterCapacity N4/D6: switching the selected line inside the 250ms debounce window silently
  drops the pending capacity change (see CAS-INT-005's note in `specifications/REQUIREMENTS.yaml`).
- CAS-INT-006's "then" clause requires a comparison ANIMATION; only the ranked list + chosen-order
  detail exist so far, no animation (that's motion-pass scope, see below).

**Static visual system landed**: `src/index.css` (Archivo, color tokens, spacing, component states),
3 real breakpoint screenshots in `verification/SCREENSHOTS/static-visual-system/`. Real Lighthouse
baseline (`verification/PERFORMANCE/lighthouse_baseline_2026-10-09.json`): Performance 98,
Accessibility 100, LCP 2.1s, CLS 0 -- comfortably inside targets.

**NetworkView.tsx networkEncoding pass landed** (`verification/SCREENSHOTS/networkEncoding/`): SVG
now matches `specifications/DESIGN_SYSTEM.json`'s actual tokens (binding=copperHot+casing,
removed/outaged=deEnergized not fault-red, candidates=diagnosticDim not a forbidden hue,
selection=text-color brackets), copper-bloom glow filter, real in-SVG focus ring. Re-measured
Lighthouse after: identical (98/100/2.1s/0) -- the glow filter costs nothing measurable at rest.
Found and fixed a genuine axe-core "nested-interactive" WCAG 4.1.2 violation along the way
(`e2e/a11y.spec.ts`, now passing) and a touch/tap coverage gap (`e2e/touch.spec.ts`, 5 tests).

**Architecture-stabilization phase landed** (the user's explicit directive before chapter motion):
docs/ART_DIRECTION.md requires every control to mount in both its home chapter and chapter 6's lab.
As originally written, 4 controls had local-only draft state and CompareRestoration had a per-mount
private Worker -- a second mount would show stale/diverging data or load WASM twice. Fixed:
- `CompareRestoration`'s preset/status/ranking/chosen + its private Worker lifted into `AppState`/
  `AppProvider` (one Worker, one result, shared across any number of mounts).
- `IncreaseLoad`/`ReduceGenerator`/`AlterCapacity`/`LineOutage`'s draft state (selection + not-yet-
  applied value) lifted into `AppState` the same way, each set via ONE dispatch per change (also the
  root-cause fix for the original select-then-slider race, not just a workaround for it).
- Every control's heading id and NetworkView's glow-filter id now use `useId()`, not a hardcoded
  string -- would have collided the instant any control/stage mounts twice.
- A real behavior change surfaced and intentionally kept (not silently absorbed): "Reset to baseline"
  now clears draft SELECTION too, not just the value -- a strictly stronger guarantee against stale
  drafts than the old per-component behavior. Two e2e tests updated to match, with the reasoning
  documented inline.
- Dual-mount proof tests added: `src/app/dualMount.test.tsx` (vitest/RTL, real Worker via highsLoader,
  proves two mounted instances of IncreaseLoad/ReduceGenerator share state both directions) and
  `e2e/dualMount.spec.ts` (real browser, proves at most one restoration Worker is ever constructed
  across repeated Compare clicks with different presets -- NOT yet a true two-DOM-instance proof: the
  app doesn't dual-mount any control until chapter scaffolding exists, so this only exercises the one
  existing mount repeatedly; honestly scoped in the test's own header comment, revisit once a chapter
  actually renders a control twice).
- `docs/planning/cascadia/CHAPTER_ARCHITECTURE.md` (new): resolves the real contradiction between
  "one persistent SVG stage" and chapter 3's locator inset / chapter 5's 3 mini networks (resolution:
  the stage is the one canonical INTERACTIVE NetworkView; insets/minis are a non-interactive render
  variant of the same encoding logic, needs a `interactive: boolean` prop on NetworkView.tsx -- not
  built yet), and the display rule for what the stage shows in chapters 2-5 (story fixture until the
  user's own live action diverges from baseline, then the live result, labeled distinctly). Read this
  file before writing any chapter/scroll code.

Test counts as of commit 905031f: 21/21 vitest, 46/46 e2e, 26/26 pytest, production build clean.

## Next: the 6 cinematic chapters (CAS-MOTION-001, the largest unstarted gate)

Read `docs/planning/cascadia/CHAPTER_ARCHITECTURE.md` FIRST (the story/lab boundary, the persistent-
stage resolution, the chapters 2-5 display rule) -- this is now the authoritative pre-read, not just
the bullet points below.

Chapter table (6 chapters: Grid formation / demand and generation / capacity bottlenecks / outage
cascades / recovery plans / scenario laboratory), plus a 4-beat opening (0-12s: blackout -> network
draws itself -> flow pulses -> fault interrupts, hands off to controls). Full detail in
`docs/ART_DIRECTION.md`.

**Remaining build order:**
1. Add `interactive: boolean` (default true) to `NetworkView.tsx` per `CHAPTER_ARCHITECTURE.md`
   section 2 -- strips role/tabIndex/testid/focus-ring/selection-bracket treatment for chapter 3's
   locator inset and chapter 5's mini networks, while reusing the identical, already-independently-
   reviewed `lineVisual`/color/glow logic (not a hand-rolled second copy).
2. Build oracle-generated, labeled, precomputed fixtures for each chapter's story state (per the
   story/lab boundary -- chapters display fixtures, never trigger live solves). Version/checksum them
   like `public/data/precomputed/*.json` already are.
3. Chapter 1 (the 4-beat intro) first, then measure frame pacing on the PRODUCTION build before
   building chapters 2-6 -- `docs/ART_DIRECTION.md` section 4 has specific kill criteria (p95 frame
   time thresholds, real device/CPU-throttle profiles) for the glow-filter-during-live-transform case.
4. Chapters 2-6, each with its reduced-motion fallback built alongside (not after), `gsap.context()`
   cleanup on unmount, reverse-scroll tested per chapter. Chapter 5 (recovery plans) is where
   CAS-INT-006's comparison animation belongs -- and its 3 mini networks use the `interactive: false`
   variant from step 1.
5. Reuse SIGNALROOM's evidence-harness pattern (`~/documentation/PATTERNS.md`) for breakpoint/scroll/
   frame-pacing capture rather than writing new capture scripts from scratch.

**Known gaps to close during/after the chapter build, not before (don't block chapters on these):**
- `RemoveNode.tsx`'s single app-wide "Reset to baseline" button will duplicate the instant it's
  dual-mounted (home chapter 4 + lab chapter 6) -- `getByRole('button', {name: 'Reset to baseline'})`
  locators across the e2e suite need scoping at that point. Not an issue yet (nothing dual-mounts
  today).
- Control section locators in e2e tests (`section:has-text(...)`) will likely need migrating to
  `getByRole('region', {name: ..., exact: true})` once controls sit inside chapter `<section>`s with
  more surrounding text (risk of strict-mode multi-matches, not yet verified as an actual problem).
- The "current chapter" detection mechanism (for the display rule in `CHAPTER_ARCHITECTURE.md`
  section 3, and ScrollTrigger wiring generally) isn't chosen yet.

## Resume point if this session ends mid-chapter-work

Check `git log --oneline -10` for the most recent commit, and re-read this file plus
`docs/planning/cascadia/CHAPTER_ARCHITECTURE.md` by then.
