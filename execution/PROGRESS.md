# Progress

Last updated manually, 2026-10-09 (static visual system landed, networkEncoding pass in progress).

## State: M4 functional/analytical phase COMPLETE and independently verified; visual pass underway

All 7 required interactions (CAS-INT-001 through CAS-INT-007) are implemented and each
independently adversarially reviewed, with no P0/P1 defects found anywhere:

- CAS-INT-001 (remove substation), CAS-INT-005 (alter line capacity): `verification/D1_D2_INDEPENDENT_REVIEW.md`
- CAS-INT-002 (increase load), CAS-INT-003 (reduce generator), CAS-INT-007 (line outage): `verification/M4_WAVE1_INDEPENDENT_REVIEW.md`
- CAS-INT-004 (add line), CAS-INT-006 (compare restoration): `verification/M4_INT004_006_INDEPENDENT_REVIEW.md`

Two known pre-existing P2s remain open and tracked (not release-blocking, not touched yet):
- AlterCapacity N4/D6: switching the selected line inside the 250ms debounce window silently
  drops the pending capacity change (see CAS-INT-005's note in `specifications/REQUIREMENTS.yaml`).
- CAS-INT-006's "then" clause requires a comparison ANIMATION; only the ranked list + chosen-order
  detail exist so far, no animation (that's motion-pass scope, see below).

Also fixed along the way: `playwright.config.ts` is now hermetic (fresh build every run, no stale
server reuse), a React StrictMode bug in `CompareRestoration.tsx`, GSAP's license checked directly
(free for this project's use, not OSI/MIT -- see `CLAUDE.md`), touch/tap e2e coverage added
(`e2e/touch.spec.ts`, 5 tests), and the static visual design system applied (`src/index.css`:
Archivo, color tokens, spacing, component states) with 3 real breakpoint screenshots in
`verification/SCREENSHOTS/static-visual-system/`.

**Real Lighthouse baseline (`verification/PERFORMANCE/lighthouse_baseline_2026-10-09.json`), measured
on the production build BEFORE any motion/glow work**: Performance 98, Accessibility 100, LCP 2.1s,
CLS 0, TBT 0ms, Speed Index 1.8s -- all comfortably inside the quality directive's targets (90+/95+/
<=2.5s/<=0.1). Worth re-measuring once the glow filter and chapter motion land, since those are the
likeliest things to cost budget.

**In progress (delegated to an isolated worktree agent, not yet merged as of this writing)**: a
networkEncoding correctness pass on `src/visualization/NetworkView.tsx` -- the current SVG rendering
uses several colors that don't match `specifications/DESIGN_SYSTEM.json`'s actual tokens (binding
lines in fault red instead of copperHot, removed/outaged lines in fault red instead of deEnergized,
candidate lines in a forbidden ad hoc color `#7FD6B0` instead of diagnosticDim, selection in diagnostic
blue instead of the text-color bracket treatment), plus the `copper-bloom` glow filter and a real
in-SVG focus ring are still missing. Check `git log --oneline` for whether this landed; if not, the
work is described in detail in the Agent-tool call that launched it (search this session's own
history, or just redo it following `specifications/DESIGN_SYSTEM.json`'s `networkEncoding`/`glow`/
`componentStates.networkFocusRing` sections directly).

Test counts as of commit 7316566: 18/18 vitest, 44/44 e2e, 26/26 pytest, production build clean.

## Next: the 6 cinematic chapters (CAS-MOTION-001, the largest unstarted gate)

Per `verification/D1_D2_INDEPENDENT_REVIEW.md`'s art direction research and
`docs/planning/cascadia/IMPLEMENTATION_PLAN.md`'s chapter list (6 chapters: Grid formation / demand
and generation / capacity bottlenecks / outage cascades / recovery plans / scenario laboratory),
plus a 4-beat opening (0-12s: blackout -> network draws itself -> flow pulses -> fault interrupts,
hands off to controls).

**Build order (advisor-recommended, to avoid rework):**
1. Write down the story/lab boundary: scroll-driven chapters must NEVER call the shared `lpClient`
   (a scroll-triggered solve would supersede a user's in-flight real solve -- the exact hang class
   already proven and fixed for CompareRestoration). Chapter data comes from oracle-generated,
   labeled, precomputed fixtures (same pattern as `public/data/precomputed/*.json`), not live solves.
   No displayed number may tween/interpolate during a transition -- animate stroke/color/opacity,
   swap number text discretely.
2. Static visual system first, NO motion: apply `specifications/DESIGN_SYSTEM.json`'s tokens, load
   Archivo (already referenced in NetworkView's font-family but not actually loaded as a webfont --
   verify), restyle the current default-browser-chrome controls, build the 3 required compositions
   (1440x900, 768x1024, 390x844) as real screenshots. Independent visual QA on these screenshots is
   MANDATORY per the parent `~/CLAUDE.md` directive before any motion work starts.
3. Chapter 1 (the 4-beat intro) first, then measure frame pacing on the PRODUCTION build before
   building chapters 2-6 -- `docs/ART_DIRECTION.md` has specific kill criteria for the
   SVG-glow-filter technique if it can't hold budget.
4. Chapters 2-6, each with its reduced-motion fallback built alongside (not after), `gsap.context()`
   cleanup on unmount, reverse-scroll tested per chapter. Chapter 5 (recovery plans) is where
   CAS-INT-006's comparison animation belongs.
5. Reuse SIGNALROOM's evidence-harness pattern (`~/documentation/PATTERNS.md`) for breakpoint/scroll/
   frame-pacing capture rather than writing new capture scripts from scratch.

**Known gaps to close during/after the chapter build, not before (per advisor, don't block chapters on these):**
- Zero touch/tap e2e coverage exists for any control (`CAS-UX-001` requires it). At 390px the 960-wide
  network SVG scales ~0.4x, shrinking hit targets significantly -- worth checking during the 390
  composition work specifically.
- Control section locators in e2e tests (`section:has-text(...)`) will likely need migrating to
  `getByRole('region', {name: ..., exact: true})` once controls sit inside chapter `<section>`s with
  more surrounding text (risk of strict-mode multi-matches flagged by advisor, not yet verified as
  an actual problem).

## Resume point if this session ends mid-chapter-work

Check `git log --oneline -10` for the most recent commit, and re-read this file plus whichever
chapter-specific planning note exists under `docs/planning/cascadia/` by then.
