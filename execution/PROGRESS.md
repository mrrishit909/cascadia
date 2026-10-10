# Progress

Last updated manually, 2026-10-09 (architecture-stabilization phase complete, plus a second advisor-
review pass that closed 3 more real gaps before chapter scaffolding begins).

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

**Second advisor-review pass landed** (post-architecture-stabilization, pre-chapter-scaffolding cleanup;
commits `83d55a2`..`f521797`):
- **Duplicate ARIA live regions fixed.** `RemoveNode`/`AlterCapacity`/`ScenarioReadout` (4 call sites)
  each carried their own `role="status"`/`role="alert"` element, firing up to 6 duplicate screen-reader
  announcements per solve. Added `StatusRegion`/`RestorationStatusRegion`, each mounted exactly once in
  `App.tsx`. First version of this fix had a real defect (caught by a second advisor pass, not shipped
  unverified): it conditionally mounted/unmounted the live-region nodes, which screen readers frequently
  never announce (a region needs to exist before its content changes, not appear already populated).
  Fixed to two permanently-mounted, `.sr-only` nodes per subsystem (one status, one alert), text-only
  changes. `e2e/a11y.spec.ts` asserts a stable count of 4 + a text-content transition; mutation-checked
  against both the pre-fix and the first-defective-fix versions.
- **`CHAPTER_ARCHITECTURE.md` section 3 corrected twice.** Original `result !== baseline` check was
  object-identity (breaks on apply-then-revert-to-default) and global (one chapter's edit would flip
  every chapter's stage). First rewrite fixed the scoping but still compared against `state.baseline`
  (a result object, not a `Scen`) -- same identity bug, still present. Now implemented as actual code,
  `src/app/chapterDivergence.ts` (`chapter2Diverged`..`chapter5Diverged`), each comparing only the
  fields that chapter's own control(s) write against the literal default `Scen` values the `reset`
  reducer restores. `src/app/chapterDivergence.test.ts` covers the apply-then-revert case that broke
  the original check. Still-open gap flagged in the doc: per-chapter readouts (not just the stage) need
  to switch source along with the fixture/live-result choice -- not yet implemented.
- **`e2e/dualMount.spec.ts`'s "true singleton" claim corrected** in `PROGRESS.md` (this file) to match
  the test's own honest header comment: it proves at-most-one-Worker across repeated clicks on the one
  existing mount, not a real two-DOM-instance proof (nothing dual-mounts until chapter scaffolding
  exists).
- **Reset button moved out of `RemoveNode`** into `src/app/ResetButton.tsx`, its own always-single-mount
  home, ahead of `RemoveNode` ever being dual-mounted (done proactively, not reactively, per advisor's
  ordering of the remaining shell work).

Test counts as of commit `f521797`: 31/31 vitest, 47/47 e2e, 26/26 pytest, production build clean.

**Locator migration landed** (commits `42e8f7e`, `ee3dc27`, `4b779fd` -- user-directed "CONTINUE FROM
VERIFIED CHECKPOINT" directive):
- All 7 controls gained `placement: 'home' | 'lab'` (default `'home'`), rendered as `data-placement` on
  each control's root `<section>`. `e2e/helpers/placement.ts` added `home(page)`/`controlHome(page,
  label)` for scoping; every control-internal e2e selector (testids, role queries, select/slider
  lookups) migrated to use them. A real bug was found and fixed mid-migration: chaining
  `home(page).locator('section:has-text(...) ...')` looks for a nested `<section>` inside the 7 already-
  section-level home roots, which never exists -- caught immediately by a full-suite run (29/47 failed),
  fixed with `controlHome()` (filters by text content first), re-verified 47/47.
- **Real LineOutage dual-mount bug found and fixed** (`ee3dc27`): its focus-management effect had no
  initial-mount guard, so mounting a second instance while a line was already selected (shared
  `outageLine`) yanked keyboard focus to that instance's own trigger button on mount. Reproduced with a
  failing vitest test first, then fixed with a `justMounted` ref guard.
- **A REAL second placement is now permanently mounted** (`4b779fd`, `LabStub` in `App.tsx`): this is
  the actual dual-placement gate proof the migration was missing until an advisor pass caught that the
  prior two commits were never run against a genuine second mount. Surfaced two more real bugs
  immediately: an axe-core `landmark-is-unique` violation (two identically-named `<section>` regions;
  fixed with an sr-only " (laboratory)" heading suffix on the lab placement only) and 9 vitest unit tests
  that broke outright once a second mount existed (fixed by scoping their queries through a `home()`
  helper, mirroring the e2e pattern). `LabStub` is not a throwaway -- the real chapter 6 laboratory
  replaces its shell (layout/heading/styling) but reuses its exact mount list.
- **Not yet done, flagged by the same advisor pass, deliberately deferred (not blocking the shell
  skeleton, but blocks calling the architecture gate passed):** `DESIGN_SYSTEM.json`'s
  `componentStates.statusRegion` token specifies a VISIBLE status plate (colors/glyphs per state, RETRY/
  UNDO LAST CHANGE actions, "last result held at 60% opacity" while solving) -- the `.sr-only`
  `StatusRegion`/`RestorationStatusRegion` fix only satisfies the live-region/announcement requirement,
  not this. The two are not in conflict: the sr-only regions stay exactly as committed (they're correct
  for what they do), and a separate, visible, fixed-height plate near the legend still needs to be built
  as its own shell deliverable so there's no CLS regression when it's added. `StatusRegion.tsx`'s "this
  is it" doc comment overclaims until that plate exists.
- **Also flagged, not yet resolved:** the design spec's `ariaLive` is `polite` for every state including
  error/infeasible, but the current regions use `role="alert"` (assertive) for those -- pick one and
  document why once the visible plate is built.

Test counts as of commit `4b779fd`: 33/33 vitest, 47/47 e2e (incl. axe-core clean against the real
dual-mount), 26/26 pytest, production build clean.

**Known inconsistency, not yet resolved:** `LabStub` currently mounts `AddLine` with BOTH `placement=
"home"` (in the `home-controls` div) and `placement="lab"` (in the lab section) -- i.e. today's app has
a "home" AddLine that doesn't correspond to any real chapter, since `docs/ART_DIRECTION.md`'s own
chapter table gives AddLine no home chapter at all (lab-only). This was mounted uniformly across all 7
controls for simplicity while proving the dual-placement scoping infrastructure; it is NOT a claim that
AddLine's home-chapter question is resolved (see `CHAPTER_ARCHITECTURE.md`'s still-open item on this).
Whoever builds the real chapter shell should drop AddLine's "home" mount (or confirm the opposite) rather
than copy this stub's mount list unchanged.

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

**Immediate next step (advisor's ordering, before any chapter/GSAP code):** the locator migration, as
its OWN commit with no app change yet. Every control-internal testid (`unserved-mw`, `cap-factor`,
`binding-lines`, `cr-n-orders`, `cap-flow`, etc.), bare `getByRole("slider")`,
`getByRole("checkbox", {name: "Allow load shedding"})`, and `getByRole("button", {name: "Compare"})`
will multi-match the instant any control mounts in both its home chapter and the chapter 6 lab --
Playwright strict mode will fail, not silently pass wrong. Grep first to size the job; add a placement
wrapper attribute (e.g. `data-placement="home"|"lab"`) and scope every existing test to `home` through a
helper; the suite must stay green on TODAY's single-mount app before anything mounts twice, so the
migration itself is proven safe in isolation.

**Known gaps to close during/after the chapter build, not before (don't block chapters on these):**
- Reset button already moved out of `RemoveNode` (see above) -- no longer a gap.
- Each chapter 2-5 story-fixture readout needs to read from the SAME source as its stage (fixture vs.
  live result) once fixtures exist -- flagged in `CHAPTER_ARCHITECTURE.md` section 3, not implemented.
- CAS-INT-004 (AddLine) has no home chapter in `ART_DIRECTION.md`'s own table -- confirm this is
  intentional before building the shell around it.
- The "current chapter" detection mechanism (for the display rule in `CHAPTER_ARCHITECTURE.md`
  section 3, and ScrollTrigger wiring generally) isn't chosen yet.
- A worktree-isolated independent reviewer should cover all of this plus the original 10-item
  architecture acceptance gate before any GSAP/chapter code is written (user's explicit requirement).

## Independent worktree review completed (opus, HEAD `96d178c`) -- 3 P1s fixed, commit `d9b5c7c`

Returned **NO-GO** for chapter/GSAP work with 3 P1 blockers, all reproduced before fixing then
mutation-checked: (1) LineOutage confirm dialogs re-targeted by another mounted instance changing the
shared line selection -- a destructive action could be confirmed against the wrong line; (2) `<output>`
elements' implicit `role="status"` duplicated live announcements a third, previously-invisible way (not
caught by axe or the CSS-attribute-based live-region count); (3) no permanent e2e test ever drove the
real lab placement. All fixed; see commit `d9b5c7c`'s message for full detail. Verified: 35/35 vitest,
48/48 e2e (incl. axe-core), 26/26 pytest.

The review also confirmed, independently (worth trusting over self-report alone): the architecture is
otherwise sound -- exactly one Worker per `AppProvider` (main + restoration) regardless of mount count,
shared drafts sync correctly in both directions, every `[id]` stays unique, and every test-count claim
in this file was real at time of review. Locator scoping (`home`/`controlHome`) was spot-checked across
4 e2e files not touched by any bug fix and found correctly applied everywhere.

**Review findings deliberately deferred (not silently dropped), ranked by the review's own P2/P3 split
-- land these alongside chapter work, not necessarily before it:**
- P2: the visible status plate `DESIGN_SYSTEM.json`'s `componentStates.statusRegion` token specifies
  (colors/glyphs per state, RETRY/UNDO LAST CHANGE actions, 60%-opacity-while-solving) still doesn't
  exist; the `.sr-only` live regions satisfy the announcement requirement only, not this. Also still
  missing: the token's `initial`/`empty`/`cancelled`/`missingFixture` states (a superseded solve is
  currently swallowed silently, no "Superseded by newer input" shown anywhere) and reconciling the
  token's `ariaLive: polite`-for-everything with the current `role="alert"` (assertive) on error/
  infeasible.
- P2: `chapterDivergence.test.ts` hand-builds its test objects instead of going through the real
  `setLoadScale`/reducer -- would still pass if the key-deletion-on-revert behavior it depends on
  regressed. Should exercise the real actions instead.
- P2: chapter 5's divergence semantics are underspecified in the code as it stands --
  `reset` never touches `AppState.restoration` (so chapter 5 stays "diverged" after a baseline reset),
  and `restorationLoading`/`restorationPreset` both clear `ranking` (so chapter 5 flips back to its story
  fixture on every Compare click and every preset change, not just a real user-initiated reset). Decide
  the intended behavior before wiring chapter 5's fixture/live-result switch to this predicate.
- P2: `LabStub`'s nested-panel layout (padding compounds, cramped at 390px) and heading levels (its own
  controls render `<h2>` at the same level as the stub's own "Scenario laboratory" `<h2>`, should be
  `<h3>`) -- stub-only issues, the real chapter 6 shell replaces this layout entirely.
- P2: drop `AddLine`'s inconsistent "home" mount in `LabStub` (lab-only per `ART_DIRECTION.md`'s chapter
  table) and move its e2e tests from `home()`/`controlHome()` to `lab()`/`controlLab()` once that's
  decided -- 7 locators currently depend on the home mount existing (`addLine.spec.ts` lines 16, 26, 53,
  67, 77, 95, `touch.spec.ts:42`); all fail loudly rather than pass for the wrong reason today, so this
  is safe to defer, not a silent landmine.
- P3: neither Worker (main solver, restoration) is ever terminated on `AppProvider` unmount.
- P3: `concurrency.spec.ts:92`'s `getByText(/Solving/).first()` now resolves to the hidden StatusRegion
  node rather than a visible control's own text -- still passes, but no longer proves what its comment
  claims.
- P3: `controlHome`/`controlLab`'s text-based `.filter({hasText})` matching is substring-fragile to
  future heading copy changes.
- P3: running the e2e suite regenerates (and the harness must re-commit)
  `verification/SCREENSHOTS/cas-int-001-keyboard-remove.png` -- expected, not a bug, but worth remembering
  when reviewing a diff that touches this file for no apparent reason.

## Chapter shell skeleton landed (commit `4f7cf30`) -- static structure, no GSAP motion yet

Per the user's "CINEMATIC EXPERIENCE IMPLEMENTATION" directive, following the advisor-reviewed
two-pass plan (shell first, verified and committed; motion second, one chapter at a time):

- **Persistent stage**: one `<NetworkView>`, `position: sticky` (`src/scenes/experience.css`), lives
  outside every chapter's own content flow. Its on-screen slot is driven by CSS keyed on
  `data-active-chapter`; its displayed data (story fixture vs. live result) by `chapterDivergence.ts`'s
  per-chapter predicates (already built/tested in an earlier pass).
- **Active-chapter detection**: `src/scenes/useActiveChapter.ts`, IntersectionObserver-based, UI-only
  state (never `AppState`). Real bug found and fixed while building this: the effect ran once while
  Scene's loading placeholder was showing (no chapter sections exist yet), found nothing, and never
  retried once the real markup mounted due to a static dependency array -- would have stuck the active
  chapter forever on EVERY real page load, not just in tests. Fixed with a MutationObserver fallback;
  regression test `src/scenes/useActiveChapter.test.tsx`, mutation-checked.
- **Chapter 4's story/lab ledger** (`src/scenes/Chapter4Ledger.tsx`): the advisor review's "not
  deferrable" item is done -- shows `ch4_fault_bus26.json` until the user's own action diverges, then
  switches to live with a visible STORY/YOUR SCENARIO label.
- **Controls rehomed** to their real chapters (ch2/3/4/5 + ch6 lab with all 7, including AddLine which
  is now correctly lab-only per DESIGN_SYSTEM.json's own `chapters` array -- the inconsistency flagged
  in the prior update is resolved). `placement` is now a REQUIRED prop on all 7 controls.
- Test migration found and fixed two more real things: the `home-controls` RTL wrapper's replacement
  (`src/app/testHelpers.ts`'s `homeControl(label)`), and several existing e2e tests that had been
  silently relying on accidental browser auto-scroll-on-focus to land on the right chapter -- fixed
  properly with a real `scrollToChapter(page, id)` helper (`e2e/helpers/placement.ts`) and a
  `MockIntersectionObserver`/`activateChapter` test-setup.ts helper for vitest, not papered over.

Test counts as of `4f7cf30`: 39/39 vitest, 49/49 e2e (incl. axe-core), 32/32 pytest, clean build. Real
screenshots at all 3 breakpoints: `verification/SCREENSHOTS/chapter-shell/`.

**Known gap, not yet fixed:** `addedLines`/`candidates` are passed to the stage UNCONDITIONALLY from
live state (not chapter-gated like `stageResult`/`stageRemovedBus`/etc.), since AddLine is lab-only and
lab is always-live anyway -- harmless today, but means a candidate line added via the lab would show on
EVERY chapter's stage, including chapter 1's baseline story, if a user later scrolled back up. Minor,
flagged for whoever adds AddLine's own divergence predicate if this ever matters visually.

## Next: GSAP motion, one chapter at a time (not yet started)

Per the approved sequence: intro's 4-beat storyboard first (`docs/ART_DIRECTION.md` section 4's table,
`intro_fault_line33.json` fixture already generated for beat 4), measure frame pacing on the production
build against the kill criteria (section 4's table) before chapters 2-6, each with reduced-motion
fallback built alongside (not after) since the skeleton's current state already IS the reduced-motion
end state for every chapter (no motion exists yet to reduce). Remaining P2/P3 items from the independent
review (visible status plate, chapterDivergence.test.ts going through the real reducer, LabStub-specific
issues now moot since LabStub is gone, Worker termination on unmount) still tracked, land alongside
chapter work. Portrait-specific NetworkView layouts exist (`orientation="portrait"` prop, camera support)
but are not yet WIRED INTO the chapter shell's tablet/mobile CSS breakpoints -- next concrete gap once
chapter 1's motion pass needs them.

## Resume point if this session ends mid-chapter-work

Check `git log --oneline -10` for the most recent commit, and re-read this file plus
`docs/planning/cascadia/CHAPTER_ARCHITECTURE.md` by then. The chapter shell skeleton (static layout,
every control in its real chapter, persistent stage) is built and verified. GSAP/scroll motion has not
started -- begin with the intro's 4-beat storyboard, per `docs/ART_DIRECTION.md` section 4.
