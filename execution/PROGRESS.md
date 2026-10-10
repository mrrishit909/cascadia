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

## Shared GSAP lifecycle layer + intro beat 1 landed (commit `007e9d3`) -- acceptance gate passed

Per the "SHARED GSAP LIFECYCLE, CINEMATIC ORCHESTRATION" directive: built the shared motion
infrastructure FIRST, verified it with a real vertical slice (intro beat 1), before proceeding to the
remaining beats/chapters -- and that vertical slice did NOT pass cleanly on the first attempt. Six real
bugs found and fixed, each reproduced with a failing test (vitest or real-browser e2e) before being
fixed, not shipped on inspection alone:

1. `@gsap/react@2.1.2`'s own StrictMode handling left a duplicate ScrollTrigger behind under this
   project's React 19.3.0, confirmed via an isolated repro. Fixed in `useScene` (`src/scenes/useScene.ts`):
   every scene's setup() is idempotent, killing any ScrollTrigger already tagged with its id first.
2. `useGSAP`'s unmount cleanup calls `context.revert()`, which -- traced directly in
   `node_modules/gsap/gsap-core.js` -- takes a "soft revert" branch that does NOT remove a tracked
   ScrollTrigger from the registry. `useScene` has its own explicit unmount cleanup that `.kill()`s
   tagged triggers directly, verified working.
3. A scene's layout effect can run before a DOM node ELSEWHERE in the same commit has its ref attached
   (confirmed twice independently, not just a JSX-ordering mistake -- reproduced again in total
   isolation after the first fix). `useScene` now retries via `requestAnimationFrame` if its scope ref
   isn't ready. App.tsx also documents the specific JSX-ordering fix this forced (`IntroBeat1` must
   render after the `<section id="intro">` it references).
4. Intro beat 1's blackout opacity was originally set via plain `gsap.set()` OUTSIDE the
   ScrollTrigger-driven timeline -- reversing the timeline (on scrolling away) had nothing to reverse
   those sets to, leaving every non-hero bus permanently stuck invisible. Fixed by moving the blackout
   into the timeline via `.fromTo()`.
5. Even with that fix, a RAPID/instant scroll straight past the intro to chapter 6 still left the
   network stuck invisible -- ScrollTrigger's own `toggleActions` enter/leave pairing didn't reliably
   resolve for an instant jump with no real scroll "velocity" (confirmed `fastScrollEnd: true` alone did
   not fix it either). Redesigned: beat 1 is now driven directly by `active`
   (`useActiveChapter`'s own hardened IntersectionObserver detection) instead of a second, competing
   scroll-position mechanism -- deterministic convergence regardless of how the user got there.
6. My own first e2e test for "no duplicate solver Worker" had the wrong expected count (the test asserted
   1 Worker would be created by scrolling alone; the correct, verified behavior is 0 -- the Worker is
   lazily created only on a real user action). Caught by actually running the test against working code
   and noticing the assertion was backwards, not by assuming it should pass.

**New infrastructure, reusable by every future chapter:** `src/scenes/gsapSetup.ts` (one-time plugin
registration), `src/scenes/useScene.ts` (the shared lifecycle wrapper above), `src/scenes/
presentationCamera.ts` (centralized camera ownership: `claimCamera(ownerId, activeChapterId, camera)`
silently drops writes from a non-active scene, `resetCameraToDefault` runs on every chapter change before
that chapter's own scene can claim anything -- not yet wired to any REAL camera movement, since no
chapter has scroll-scrubbed camera work yet yet; chapters 2/3 are the ones that will need it, per
ART_DIRECTION.md's motion table).

Test counts as of `007e9d3`: 49/49 vitest, 55/55 e2e (6 new motion-specific, `reducedMotion:
"no-preference"` opted in explicitly), 32/32 pytest, clean build.

## Intro beats 2-4 + SKIP INTRO landed -- `IntroBeat1.tsx` replaced by `IntroSequence.tsx`

Built on top of the shared infrastructure above, as one continuous one-shot GSAP timeline (not four
separate scenes) covering the full 0-12s storyboard:
- **Beat 2 (3-6s)**: real breadth-first search over `network.lines` from the hero bus (`bfsFromHero`,
  not DOM inference) drives both the order lines draw in (DrawSVGPlugin `stroke-dashoffset`) and the
  order each bus fades in.
- **Beat 3 (6-9s)**: a dash-offset pulse loop on every line core whose baseline flow is non-negligible,
  direction set from that line's REAL flow sign (not a uniform direction regardless of topology -- an
  advisor review caught the first version doing exactly that). Load chevrons (already rendered by
  NetworkView from the fixture, never tweened as a number) fade in alongside.
- **Beat 4 (9-12s)**: the whole stage crossfades (0.35s out, swap, 0.35s in -- a real 700ms transition)
  to `intro_fault_line33.json` (presentation-only, via `introFixtureState.ts`; `AppState`/the live
  scenario never changes), then the FIG index/Reset button/SKIP INTRO fade in (`introChromeState.ts`).
- **SKIP INTRO** (`SkipIntro.tsx`): always mounted (never conditionally rendered, per the project's
  standing rule against mount-on-demand controls), `inert`+opacity-driven by `active==='intro'` directly
  rather than the chrome-visibility store, since it must be clickable from beat 1 onward -- it's what
  TRIGGERS the chrome reveal, not something gated by it. Resolves to the identical end state as reduced
  motion (`introSkipState.ts`), per `DESIGN_SYSTEM.json`'s own token.

**Real bugs found by an advisor review before this was committed, each fixed and verified, not just
noted:**
1. A superseded one-shot timeline was never killed between `setup()` calls -- re-entering the intro,
   leaving it mid-playback, or clicking Skip mid-playback would leave a stale timeline still firing its
   own `.set`/`.to`/`.call` steps later, re-dashing lines or re-triggering the fault after the user had
   already moved on. Fixed: `tlRef.current?.kill()` as the FIRST line of every `setup()` call, before
   either early-return branch, plus an unmount cleanup effect. Two new discriminating e2e tests prove
   this (`introMotion.spec.ts`: Skip-then-wait-9s, and scroll-away-then-wait-8s, both assert no leftover
   dash styling).
2. `clearProps: 'drawSVG'` is not a real CSS property name -- traced directly in
   `node_modules/gsap/DrawSVGPlugin.js`, which actually writes `strokeDasharray`/`strokeDashoffset`
   inline. The old clearProps call did nothing; fixed to clear the real property names.
3. A live-control leak: the intro's presentation-only fault (`stageDisabledLines=[33]` from a fixture,
   not `state.disabledLines`) made the fault line's kerf clickable via `onRestoreLine`, which would have
   fired a REAL `setLineOutage(33, false)` against a line that was never actually disabled in live
   state. Fixed: `onRestoreLine` is `undefined` while `active==='intro'`.
4. The candidate-line overlay (`[data-testid="candidate-line"]`, always rendered on the one persistent
   stage regardless of chapter -- confirmed intentional, not a bug, since `e2e/addLine.spec.ts`
   deliberately checks it before ever scrolling to chapter 6) was not included in beat 1's hide set.
   Caught by actually taking and reading real screenshots (`verification/SCREENSHOTS/intro-beat1.png`
   through `intro-beat4.png`) per this project's mandatory visual-QA rule, not assumed from reading the
   code: beat 1's "blackout, single energized node" showed every candidate line crossing the dark stage.
   Fixed by adding candidate lines to the beat 1/convergence hide set, revealed again at beat 2's end.
5. Load chevrons live inside bus `<g>` groups, so beat 2's per-bus opacity reveal was making them pop in
   early (ahead of beat 3's own fade-in). Fixed: chevrons get their own explicit opacity-0 in beat 1,
   independent of the ancestor bus group's opacity.
6. SKIP INTRO's own token says "first in tab order"; it was rendering after FigIndex/ResetButton. Moved
   to the first child of `<main>`.
7. A freshly built, playing GSAP timeline does not paint its time-0 state until the next ticker frame --
   without forcing `tl.render(0, true, true)` after building it, beat 1's blackout would flash the
   pre-animation default for one frame after mount, now that beat 1 lives inside the same timeline as
   beats 2-4 (the old standalone `gsap.set()` calls applied synchronously for free; a `.set()` queued
   inside a timeline does not).

`presentationCamera`'s ownership/reset tests, previously living inside the now-deleted
`IntroBeat1.test.tsx`, were moved to their own `src/scenes/presentationCamera.test.tsx` rather than lost
in the swap (a reviewer caught the test count silently dropping from 49 to 42 when the old file was
deleted without porting its non-beat-1-specific tests first).

Test counts: 52/52 vitest (up from 49: +3 net, after moving 3 camera tests out and adding 1 net new
timeline-kill regression plus losing none), 58/58 e2e (+9: `introMotion.spec.ts` now covers full
playback timing, Skip, and the two timeline-kill discriminating checks), 32/32 pytest, clean build. Real
screenshots of all 4 beats: `verification/SCREENSHOTS/intro-beat1.png` through `intro-beat4.png`.

**Not yet done:** the FIG index's own entry animation (currently a plain opacity fade via CSS, not a
distinct GSAP-authored motion), and all 6 chapters' real choreography (camera scrub for 2/3, the
single-tween fracture for 4, the step-driven comparison for 5, result-driven feedback for 6). Frame-
pacing measurement against ART_DIRECTION.md's kill criteria has NOT been done yet -- do this once at
least one chapter's glow-filter-under-transform case exists too, not before (measuring the intro alone
wouldn't be representative of steady-state chapter scroll-scrub performance). Portrait-specific
NetworkView layouts exist (`orientation="portrait"` prop, camera support) but are not yet wired into the
chapter shell's tablet/mobile CSS breakpoints. Remaining P2/P3 items from the earlier independent review
(visible status plate, chapterDivergence.test.ts going through the real reducer, Worker termination on
unmount) still tracked, land alongside chapter work.

## Chapter 1 ("Grid formation") landed

Per the "COMPLETE SIX-CHAPTER CHOREOGRAPHY" directive, beginning with chapter 1 (immersive canvas,
section 3's simplest archetype, and the one chapter that reuses the intro's own already-verified
baseline-display logic rather than introducing new analytical branching).

**A real pre-existing bug found before any chapter motion could be verified at all:** the FIRST real
(non-`fullPage`) screenshot ever taken of a chapter mid-scroll showed the persistent stage completely
blank. Traced to `index.css`'s generic `section { background: var(--surface); border: ... }` rule
(written for control-panel cards like IncreaseLoad/ReduceGenerator, which are plain `<section>`s)
silently also painting an OPAQUE rectangle over every `.chapter-section`, hiding the shared stage
(z-index 1 vs. the section's z-index 2) on every real scroll. This was invisible in every screenshot
this project had taken of the chapter shell before now because they all used Playwright's
`fullPage: true`, which freezes a `position: sticky` element at its initial flow offset instead of
re-pinning it per virtual viewport slice -- a known Chromium/Playwright limitation, not a quirk of
this app. Confirmed via direct `getComputedStyle` inspection (`backgroundColor: rgb(15,23,34)`
covering the full viewport rect) before fixing, not assumed. Fixed: `.chapter-section` now explicitly
overrides `background: transparent; border: none`, with a comment flagging that chapters 3/5/6 may
want to reintroduce their OWN intentional card framing once their corridor-strip/comparison-columns/
inspector-rail layouts are built, so this default should be revisited per chapter, not assumed
permanent. This fix touches every chapter, so it was verified against the FULL existing e2e suite
(64/64 green) before trusting it, not just chapter 1's own new tests.

**New shared primitive, reused by all 6 chapters:** `src/scenes/ChapterTitle.tsx` -- the motion
sheet's "masked text reveal... chapter titles only, 800ms, once per entry, replay on index
navigation" effect, implemented as a `clip-path: inset()` vertical wipe driven directly by each
chapter's own `active` prop (same `useScene`/`active`-driven pattern as the intro, not a second
competing ScrollTrigger mechanism). "Replay on index navigation" falls out for free: FigIndex clicks
and real scrolling both flow through the same `useActiveChapter` value. Wired onto all 6 existing
chapter `<h2>` headings in `App.tsx` in this same pass (cheap to do once, avoids 5 more near-identical
diffs later). Reduced motion shows the title instantly, no clip. Unit tests:
`src/scenes/ChapterTitle.test.tsx` (hidden-while-inactive, armed-on-entry, reduced-motion-instant,
re-clips-on-exit-for-replay).

**Chapter 1 content:** `src/scenes/LegendPlate.tsx` -- ART_DIRECTION.md section 3's "only other
element besides the full-bleed network" (cols 1-4 desktop / cols 1-5 tablet, both bottom-anchored 24px
from the viewport bottom per `grid.legendPlate` in `DESIGN_SYSTEM.json`; mobile moves it to the top,
below the FIG index strip, full width minus margins). Houses the chapter title (via `ChapterTitle`)
and 3 rows of REAL figures read directly from `state.network`/`state.baseline.result` (bus/line
counts, served-of-total MW, solver status) -- nothing fabricated, nothing animated as a count-up.
Always mounted, shown via `inert`+opacity exactly like FigIndex/ResetButton/SkipIntro, driven directly
by `active==='ch1'`. An earlier version placed the title/prose as a SEPARATE floating block outside
the plate; a real screenshot showed it visually colliding with the network's own bus-14 label, so it
was folded into the plate itself, matching the spec's "only other element" wording more literally and
fixing the collision in one move.

Chapter 1's own motion-sheet row ("fault heals to baseline... reduce replays fault") needed no new
code: `IntroSequence`'s existing convergence branch already reverts `introFaultActive` to false and
clears all intro-only opacity/filter work the instant `active!=='intro'`, and `App.tsx`'s own
story/lab switch already has no override branch for `ch1` (falls through to `state.baseline.result`
unconditionally) -- so chapter 1 was already analytically and visually correct the moment the
background bug was fixed; the only genuinely new motion is the title reveal above.

**Verified:** entry, reverse-scroll, instant FIG-index jump (from chapter 6, skipping every
intermediate chapter), reduced motion, and analytical-state preservation (scrolling through chapter 1
alone creates zero solver Workers) -- `e2e/chapter1.spec.ts`, 6 new tests. Real screenshots at all 3
required breakpoints plus reduced motion, read and inspected (not just generated) before calling this
chapter done: `verification/SCREENSHOTS/ch1-desktop-1440x900.png`, `ch1-tablet-768x1024.png`,
`ch1-mobile-390x844.png`, `ch1-reduced-motion.png`. Tablet/mobile currently reuse the SAME landscape
network layout coordinates, scaled down (not a true portrait-specific re-projection per
ART_DIRECTION's responsive table) -- this is the SAME pre-existing, already-tracked gap noted in the
prior milestone (`orientation="portrait"` exists on NetworkView but isn't wired into the chapter
shell), not new to chapter 1, and not fixed here; still open for a dedicated responsive pass.

Test counts: 56/56 vitest (+4: ChapterTitle), 64/64 e2e (+6: chapter1.spec.ts), 32/32 pytest, clean
build.

## Chapter 2 ("Demand and generation") landed

Editorial split, prose-led. New: `src/scenes/Chapter2Scene.tsx` (this project's FIRST real
ScrollTrigger scrub -- the intro deliberately avoided ScrollTrigger's own toggle/progress heuristics
for its one-shot beats; a genuinely continuous scroll-bound pan is a different, legitimate use of the
same plugin) and `src/scenes/BalanceRule.tsx` (the generation/demand rule ART_DIRECTION.md section 3
calls for, real totals from `state.baseline.result`, never progress-derived -- no count-up numbers).
Scroll progress 0-1 over the section pans/zooms the camera (`FULL_CAMERA` to a modest pan+zoom,
`lerpCamera`, new in `presentationCamera.ts`) and crossfades the balance rule's generation row into
its demand row (two `position:absolute` rows over the same box, so the transition reads as a morph,
not two stacked blocks).

**A second real architectural bug found and fixed, more serious than chapter 1's:** `App.tsx`'s
camera-ownership reset (`resetCameraToDefault(active)`, meant to run "before that chapter's own scene
can claim anything") was a plain `useEffect`. `useGSAP` (what every chapter scene's `useScene` is
built on) uses `useLayoutEffect` internally. React runs ALL layout effects across the WHOLE tree
(children before parents) before ANY plain effect runs, with no exception for a parent/child
relationship -- so `Chapter2Scene`'s own camera claim (a child, layout effect) was firing BEFORE
`Scene`'s reset (the parent, a plain effect that React defers until every layout effect anywhere has
run), and the reset then ran LAST and silently clobbered whatever the scene had just claimed. This
was invisible in a 1-second screenshot glance (both states render a network, just at a subtly
different zoom) but caught by a direct computed-style/attribute check the moment an e2e test actually
asserted the expected `viewBox` value and it didn't match. Confirmed by reading `@gsap/react`'s own
source (`useIsomorphicLayoutEffect = useLayoutEffect` in the browser) before fixing, not assumed.
Fixed by moving the reset out of `useEffect` entirely into `Scene`'s render body itself, guarded by a
`useRef` so it fires at most once per real `active` transition: a full render pass (the whole tree)
completes before ANY effect of either kind runs, so this now unconditionally precedes every scene's
own claim regardless of effect type or component nesting -- the actual ordering guarantee the
original code's own comment wanted but a plain `useEffect` could never provide. This fix is general
(not chapter-2-specific) and will matter again for chapter 3's own camera-driven corridor-strip morph.

**A third, smaller bug found via the same screenshot-reading discipline:** tablet/mobile's "network on
top (55vh), prose below" composition for chapters 2 and 4 had no `padding-top` reserving that space,
so the chapter's own title/cards rendered starting at the section's normal padding, directly
underneath/overlapping the fixed network strip. Fixed with a targeted `padding-top: calc(55vh +
var(--sp-6))` override for `#ch2`/`#ch4` in the existing `max-width:1023px` breakpoint.

**Reduced motion's own composition bug:** both balance-rule rows are `position:absolute` over the
identical box for the crossfade; setting both to `opacity:1` for reduced motion's "both stacks shown"
state (per the motion table) produced illegible double-exposed overlapping text, not two readable
lines. Fixed by also un-stacking both rows to `position:static` specifically in the reduced-motion
branch, so they render as two normal, separate lines instead.

Verified: entry (near-zero scrub progress, generation row dominant), a safely-mid-range scrub point
(camera panned, balance rule blended ~50/50, both confirmed via direct computed-style reads, not just
a screenshot glance), leaving the chapter (camera resets to `FULL_CAMERA`), reduced motion (end-state
camera + both rows shown, non-overlapping), and analytical-state preservation (no solver Worker
created by scrolling/scrubbing alone) -- `e2e/chapter2.spec.ts`, 5 new tests. Real screenshots at all
3 required breakpoints (tablet/mobile reshot after the padding-top fix) plus reduced motion, actually
read before calling this chapter done: `verification/SCREENSHOTS/ch2-desktop-1440x900-entry.png`,
`ch2-desktop-1440x900-mid-scrub.png`, `ch2-tablet-768x1024.png`, `ch2-mobile-390x844.png`,
`ch2-reduced-motion.png`.

Test counts: 56/56 vitest, 69/69 e2e (+5: chapter2.spec.ts), 32/32 pytest, clean build.

## Chapter 2 review pass: 4 more real bugs found, all fixed (advisor review, before chapter 3 began)

An advisor review of the committed chapter 2 work, deliberately done before starting chapter 3 (which
would otherwise have copied the same scrub pattern blind), found 4 further real defects -- all
confirmed by direct reproduction, not assumed, then fixed:

1. **The scrub could never reach its own end state while chapter 2 was active.** `end:'bottom top'`
   makes progress=1 coincide almost exactly with `useActiveChapter` handing off to chapter 3 (its own
   independent IntersectionObserver dominance check), so `claimCamera`'s ownership guard silently
   dropped every claim from that point on -- "demand" could never fully show. Confirmed by sweeping
   scroll fraction 0.1-1.0 and logging `data-active-chapter`/viewBox/opacity at each step (the sweep
   script is reusable for chapter 3's own tuning). Fixed two ways together: `#ch2.chapter-section`
   given real scroll runway (`min-height: 200vh`) and the trigger's `end` moved to `'60% top'`,
   confirmed empirically to land with a comfortable margin before the actual handoff (~75-80%).
2. **No state applied when the trigger is first created.** `setup()` hard-coded gen=1/demand=0/
   `FULL_CAMERA`; the correct value for wherever the user ACTUALLY is only applied on the next scroll
   event. Arriving already mid-section (scrolling up from chapter 3, a keyboard jump that flips
   `active` without a further scroll) showed stale defaults until the next scroll, then popped.
   Fixed: one `apply(progress)` function, called both from `onUpdate` and once immediately with the
   trigger's own just-created `st.progress`.
3. **Direct FIG-index navigation landed at the scrub's START, not its end state**, contradicting
   ART_DIRECTION.md's own "Direct index navigation lands in the end state" line. Fixed in
   `FigIndex.tsx`: a `SCRUB_END_FRACTION` map (kept in sync with each scene's own trigger `end`) drives
   an `onClick` handler that scrolls to the chapter's end-state position instead of letting the native
   anchor jump land at its top; the `href` itself is left as a real anchor for middle-click/new-tab.
4. **`ChapterTitle` had the same stale-tween bug IntroSequence's own earlier review caught**: `useGSAP`
   does not revert a running tween just because `active` flipped again before the 800ms reveal
   finished, so leaving a chapter mid-reveal (a fast FIG-index jump elsewhere) let the old tween keep
   animating the hidden title back open afterward. Fixed: `gsap.killTweensOf(el)` as the first line of
   `setup()` -- the exact same fix pattern as `IntroSequence`'s `tlRef.current?.kill()`, now established
   as the standard opening move for every scene in this codebase, one-shot or scrubbed. Also fixed:
   the original branch order clipped every INACTIVE title regardless of reduced motion, so an inactive
   chapter's heading rendered as a blank gap under reduced motion (spec: "immediate text," unconditional)
   -- reordered to check `reducedMotion` before `active`.

Also added the directive's full motion-behavior checklist that chapter 2's first test pass had
skipped: reverse scroll (confirmed the scrub genuinely runs backward, not just forward), an interrupted
transition (fast-scrolling straight past chapter 2 into chapter 4 leaves no stale camera claim behind),
and the instant FIG-index jump landing correctly (item 3 above, now covered by its own regression test).
`e2e/chapter2.spec.ts` grew to 11 tests, `e2e/chapterTitle.spec.ts` (new, 2 tests) covers the shared
primitive's own regressions once, not per-chapter. One of the new tests was itself flaky on first write
(a scroll-fraction arithmetic mistake: scrolling to 50% of the SECTION gives scrub progress 0.5/0.6=
0.83 now that the trigger ends at 60%, not 0.5 -- caught by actually re-running the suite with repeats
until stable, not trusting a single green run).

Test counts: 57/57 vitest, 75/75 e2e (+2 ChapterTitle, +6 chapter2 reverse/interrupted/instant-jump/
end-state regressions), 32/32 pytest, clean build, stable across repeated runs.

## Resume point if this session ends mid-chapter-work

Check `git log --oneline -10` for the most recent commit, and re-read this file plus
`docs/planning/cascadia/CHAPTER_ARCHITECTURE.md` and `docs/ART_DIRECTION.md` section 4 (storyboard/motion
table) by then. The shared GSAP lifecycle layer, the FULL intro sequence (beats 1-4, Skip, chrome
reveal), the shared `ChapterTitle` masked-reveal primitive, chapter 1 ("Grid formation"), and chapter 2
("Demand and generation") are built, reviewed, verified, and committed -- this is the pattern every
subsequent scene should follow:
- `useScene`, not raw `useGSAP`/`ScrollTrigger`.
- **Every scene's `setup()` starts by killing its own prior work first** -- `gsap.killTweensOf()` for
  plain tweens (`ChapterTitle`), `tlRef.current?.kill()` for a one-shot timeline (`IntroSequence`).
  `useGSAP`'s own revert-on-dependency-change is NOT reliable for either case; this is now the
  established opening move for every scene, not optional per-scene judgment.
- A scroll-scrubbed scene (chapter 2's pattern, reusable for chapter 3) needs: (a) real scroll runway
  so its trigger's `end` can land comfortably BEFORE `useActiveChapter`'s own handoff point --
  sweep-test the actual handoff fraction empirically, don't guess it; (b) one `apply(progress)`
  function called both from `onUpdate` AND once immediately after `ScrollTrigger.create()`, so a user
  arriving mid-range without a further scroll event sees the correct state, not stale defaults; (c) a
  `FigIndex.tsx` `SCRUB_END_FRACTION` entry so direct index navigation lands in the end state, kept in
  sync with the trigger's own `end`.
- Camera writes go through `claimCamera`, and `Scene`'s own reset in `App.tsx` is in the render body,
  NOT a `useEffect` (React runs layout effects, which `useGSAP` is built on, children-before-parents
  the same as plain effects -- there is no ordering guarantee a parent's plain `useEffect` can lean on
  to run before a child's camera claim). Do not revert that without re-reading the comment explaining
  why.

**Before trusting ANY chapter's visual or camera state**, take and READ a real (non-`fullPage`)
screenshot at the chapter's actual scroll position, AND cross-check the specific thing that matters
(a `viewBox` attribute, a `data-*` flag, computed opacity) via direct `evaluate`/`getAttribute` -- every
real bug found across chapters 1 and 2 (the background bug, the effect-ordering bug, the unreachable-
end-state bug, the stale-tween bug) was invisible to a quick visual glance and only surfaced by checking
actual DOM/computed state or a genuinely independent review, never assumed from reading the code or
trusting one green test run.

## Chapter 3 ("Capacity bottlenecks") landed, including its own performance measurement

Focused inspector archetype: the network shrinks into a top-left locator inset (CSS `transform:scale`,
not the generic `width`-transition every other chapter's slot uses -- deliberately, see
`Chapter3Scene.tsx`'s own comment: a `width` transition competing with live `getScreenCTM()` reads
during the same window would measure mid-transition, wrong positions) and 4 fixed "rails" (the
baseline's 4 most-loaded lines by \|flow\|/rating, `computeBaselineRails` in `CorridorStrip.tsx`,
computed once, never reshuffled by a live capacity change) morph from their REAL measured screen
position in the inset into straight horizontal bars as the user scrolls, each bar's length encoding
that line's own utilization fraction (flow/rating, clamped at 1).

**Real measured SVG geometry, not a cosmetic approximation**: `Chapter3Scene.tsx` reads each rail
line's actual `x1/y1/x2/y2` directly off the live `<line data-testid="line-core">` DOM element the
main stage already renders, transforms those points through the stage SVG's own `getScreenCTM()` (a
real `DOMPoint.matrixTransform`, accounting for the CSS scale the inset is currently rendered at), and
linearly interpolates each rail's own overlay `<line>` between that measured start and a fixed
horizontal end position every scrub tick. A selected line not already a rail becomes a 5th INSPECTED
rail bound to the SAME `state.selectedLine` AlterCapacity's own `<select>` already uses (no second
source of truth) -- clicking any rail's own readout button dispatches the identical `selectLine`
action.

**The same handoff-unreachable-end-state bug chapter 2's review found, hit again and fixed the same
way, this time BEFORE committing broken work**: a scroll-fraction sweep (same method, confirmed
directly rather than guessed) showed chapter 3's default-height section handed off to chapter 4 around
50-60% through, leaving the geometry morph unable to complete while still active. Fixed identically:
`#ch3.chapter-section` given `min-height: 200vh` and the trigger's own `end` set to `'40% top'`,
reswept and confirmed to land with real margin (handoff now ~75-80%). `FigIndex.tsx`'s
`SCRUB_END_FRACTION` map extended with `ch3: 0.4` to match.

**A real layout collision found by an actual screenshot, not assumed**: the chapter's own title and
first two rails visually overlapped the shrunk locator inset (both sit top-left by default) --
measured the inset's real rendered footprint (`~237x160px` at desktop) and added `#ch3.chapter-section
{ padding-top: 280px }` (a smaller tablet/mobile override, since those insets are much smaller) to
clear it.

**The user's own explicit priority, verified directly**: changing a live simulation control (capacity
factor via AlterCapacity) WHILE the corridor morph is actively mid-scrub. Confirmed the real DC-OPF
Worker solve lands correctly, the affected rail's readout updates to the new live result, the rail
GEOMETRY itself is undisturbed by the state update (Chapter3Scene's own measurement loop doesn't read
or depend on anything the solve touches, confirmed empirically not just by code inspection), and the
scrub still converges correctly to its fully-horizontal end state afterward -- `e2e/chapter3.spec.ts`'s
own dedicated regression test for this exact scenario, plus a page-error listener asserting zero
uncaught exceptions during the whole sequence.

**Chapter 3's own frame-pacing measurement** (the user's explicit request, not deferred to after
chapter 6): `verification/PERFORMANCE/measure_ch3_framepacing.mjs` against the real production build,
glow on. Desktop 1440x900 p95 = 17.7ms, 1.0ms over the strict 16.7ms kill criterion; BOTH throttled/
mobile profiles (33.3ms criterion, the spec's actual primary target) pass comfortably. An idle-baseline
control (same page, same sampling loop, zero scrub work) measured p95=17.2ms with NOTHING happening --
this environment's own vsync/compositor measurement floor sits within 0.5ms of the "failing" desktop
number regardless of app behavior, and the scrub's real marginal cost (desktop active minus desktop
idle) is under 1ms, completely insensitive to 4x CPU throttling (strong evidence of negligible real
JS/layout cost, not a lucky measurement). Full reasoning and the raw numbers:
`verification/PERFORMANCE/CH3_FRAMEPACING_REPORT.md`. Verdict: does not trigger the escalation ladder;
ladder step 1 (fade glow during transforms) is already applied proactively in `Chapter3Scene.tsx` for
the instant inset-shrink transition on chapter entry.

Verified: entry, exit (geometry/camera/corridor-strip all reset), reverse scroll (un-straightens back
toward network position), instant FIG-index jump (lands with rails already straight), an interrupted
transition (fast-scrolling straight past chapter 3 leaves no stale geometry), reduced motion (rails
render straight immediately, confirmed via real `y1`/`y2` SVG attribute reads, not just a screenshot
glance), the fixed rail set never reshuffling under a live capacity change, the mid-morph live-control
scenario above, and analytical-state preservation (no solver Worker from scrolling alone) --
`e2e/chapter3.spec.ts`, 12 tests, stable across a 3x repeat run (36/36). A dedicated axe-core pass
scrolled to chapter 3 (new decorative SVG + real interactive buttons) found zero violations
(`e2e/a11y.spec.ts`). Real screenshots at all 3 breakpoints plus reduced motion, actually read, including
after the layout-collision fix: `verification/SCREENSHOTS/ch3-desktop-1440x900-entry.png`,
`ch3-desktop-1440x900-mid-morph.png`, `ch3-tablet-768x1024.png`, `ch3-mobile-390x844.png`,
`ch3-reduced-motion.png`.

Test counts: 61/61 vitest (+4 `computeBaselineRails`), 88/88 e2e (+12 chapter3, +1 a11y), 32/32 pytest,
clean build.

**Known, deliberate simplification** (not a gap found and left unfixed, a scope call made up front):
each rail's flow-bar length is normalized against its OWN rating (0-100% of its own limit), not a
cross-rail MW scale -- this reads as "how close to its own limit" for all 4 rails on one consistent
axis, which is arguably a BETTER fit for "capacity bottlenecks" than a shared MW scale would be, but
note it if creative review expects literal MW-proportional bar lengths instead.

## Resume point if this session ends mid-chapter-work

Check `git log --oneline -10` for the most recent commit, and re-read this file plus
`docs/planning/cascadia/CHAPTER_ARCHITECTURE.md` and `docs/ART_DIRECTION.md` section 4 (storyboard/motion
table) by then. The shared GSAP lifecycle layer, the FULL intro sequence, `ChapterTitle`, chapter 1, 2,
and 3 are built, reviewed, verified, and committed. Patterns every subsequent scene should follow:
- `useScene`, not raw `useGSAP`/`ScrollTrigger`. Every scene's `setup()` kills its own prior work
  FIRST (`gsap.killTweensOf()` for plain tweens, `tlRef.current?.kill()` for a one-shot timeline) --
  `useGSAP`'s revert-on-dependency-change is not reliable for either case.
- A scroll-scrubbed chapter (2 and 3's shared pattern, reusable for 5 if it ends up scroll-driven) needs
  real scroll runway (`min-height: 200vh` has worked twice now) and a trigger `end` with a REAL,
  EMPIRICALLY-SWEPT margin before `useActiveChapter`'s own handoff point -- never assume a round number
  is safe; sweep scroll fraction vs. `data-active-chapter` directly before picking one. One
  `apply(progress)` function, called from both `onUpdate` and once immediately after
  `ScrollTrigger.create()`. A `FigIndex.tsx` `SCRUB_END_FRACTION` entry kept in sync with the trigger's
  own `end`.
- Camera writes go through `claimCamera`; `Scene`'s own reset in `App.tsx` is in the render body, not a
  `useEffect` (React's layout-effects-before-passive-effects ordering is tree-wide, not parent-before-
  child -- do not revert this without re-reading the comment explaining why).
- When a chapter's own content might visually collide with the persistent stage's current slot
  (chapters 2/4's top network strip, chapter 3's locator inset), MEASURE the slot's real rendered
  footprint and clear it with padding -- don't guess a padding value.
- A chapter whose own scene does real DOM measurement (`getScreenCTM`, `getBoundingClientRect`) needs a
  `typeof el.getScreenCTM !== 'function'` guard (or equivalent) so vitest/jsdom, which doesn't implement
  these APIs at all, doesn't crash -- real-browser e2e is that scene's actual geometry coverage, vitest
  only needs to confirm it mounts/unmounts safely.
- A performance measurement MUST include an idle-baseline control run through the identical sampling
  method before concluding a kill-criterion "failure" reflects real app cost -- `measure_ch3_
  framepacing.mjs`'s own idle-vs-active comparison is the reusable pattern for chapters 4's fracture and
  the lab's node-removal case, both still owed their own measurement after chapter 6.

**Before trusting ANY chapter's visual or camera/geometry state**, take and READ a real (non-`fullPage`)
screenshot at the chapter's actual scroll position, AND cross-check the specific thing that matters via
direct `evaluate`/`getAttribute`/SVG-property reads -- every real bug found across chapters 1-3 (the
background bug, the effect-ordering bug, two separate unreachable-end-state bugs, the stale-tween bug,
the layout-collision bug) was invisible to a quick glance and only surfaced by checking actual DOM/
computed state or a genuinely independent review, never assumed from reading the code or trusting one
green test run.

## Chapter 4 ("Outage cascades") landed, including this project's most serious bug yet

Editorial split, canvas-led, mirrored from chapter 2 (network LEFT ~65%, fault ledger right).
`Chapter4Ledger.tsx` already had the real analytical content from the earlier chapter-shell phase, so
this pass built only the MOTION: `Chapter4Scene.tsx`, a one-shot `useScene` timeline (NOT a scroll
scrub -- ch4's own motion-table row is "single trigger," the same one-shot pattern as `IntroSequence`/
`ChapterTitle`) implementing ART_DIRECTION.md section 3's load-bearing single-shot rule: ONE 700ms
whole-stage crossfade wraps the instant baseline-to-post-fault swap (the same proven technique
`IntroSequence`'s own beat 4 established -- a React prop swap can't be intercepted mid-render to
animate a literal "before" state), the ledger's numbers are held at opacity 0 until the exact tween
completion (never mid-tween, confirmed by polling), and isolated-island buses
(`data-state="shed_no_generation"`, the real analytical marker, not a guess) nudge 24px outward from
the network's own centroid, ending there (not bouncing back) for as long as the fault condition holds.
Re-fires on every CHANGE the ledger shows (a `resultKey` derived from the displayed removed-
element/disabled-lines set), not just entry, so a later RemoveNode/LineOutage confirmation while
already on chapter 4 gets the identical single-tween treatment.

**This project's most serious bug found so far, caught by an UNRELATED test, not this chapter's own
(a real lesson in itself):** the first version cleared a bus's previous island-separation offset with
`gsap.set(bus, {x:0, y:0})`, intending "no additional offset from wherever it already is." GSAP's x/y
properties are ABSOLUTE, not relative -- this instead overwrote EVERY bus's real
`transform="translate(x y)"` position with an identity transform, collapsing the entire 30-bus network
to the SVG's origin corner, on every single mount (including the very first page load, since
`Chapter4Scene` is always-mounted like every other scene and this ran unconditionally before even
checking `active==='ch4'`). `clearProps` was tried next and was ALSO insufficient: GSAP's SVG support
can write directly to the `transform` ATTRIBUTE rather than a CSS style for an element like this, and
`clearProps` only reverses an inline style -- it does nothing for an attribute-level write, and React's
reconciliation (comparing its own virtual-DOM output, unchanged since bus layout is static) does not
re-apply the attribute on a later render either, once GSAP has overwritten it outside React's
knowledge. This was caught when `e2e/touch.spec.ts` -- a completely unrelated, pre-existing test that
never scrolls past the intro -- started timing out trying to find buses at their expected screen
position; it was NOT caught by this chapter's own first-draft tests, which only checked "not stuck at
the OLD offset" and missed that the "fixed" value was also wrong, just wrong in a different way.
**Lesson applied going forward: after any chapter's changes, re-run the FULL suite (not just that
chapter's new tests) before trusting green, and treat an unrelated test's sudden failure as a real
regression to chase down immediately, never a flake to retry past.** Fixed properly: a `useRef` map
captures each bus's TRUE natural position ONCE, the first time (and only time) this scene ever touches
it, and every later run reads from that captured value, never re-derives "natural" from the
(possibly-already-corrupted) live DOM.

Verified: entry (ledger hidden mid-tween, reveals exactly at completion), the control-change-mid-ch4
regression (re-plays the tween, updates to the new live result), the collapse-to-origin regression
specifically (every bus confirmed inside the stage's real rendered bounds after a scenario change, not
just "has some transform"), reverse (leaving mid-tween and returning replays cleanly), an interrupted
transition (fast scroll straight through leaves nothing stuck dimmed), reduced motion (instant, fully
settled), and analytical-state preservation (no solver Worker from scrolling alone) --
`e2e/chapter4.spec.ts`, 8 tests. A dedicated axe-core pass over chapter 4 found zero violations
(`e2e/a11y.spec.ts`). A real layout collision (chapter 4's own title/ledger/controls sitting in normal
document flow at the SAME left edge the network's own CSS slot already occupies -- the mirror-image of
chapter 2's problem, which doesn't hit it because chapter 2 pushes the network right instead) found via
screenshot and fixed with `align-items: flex-end` on the section. Real screenshots at all 3 breakpoints
plus reduced motion, re-captured AFTER the collapse-to-origin fix and actually read --
`verification/SCREENSHOTS/ch4-desktop-1440x900-settled.png`, `ch4-desktop-1440x900-mid-tween.png`,
`ch4-tablet-768x1024.png`, `ch4-mobile-390x844.png`, `ch4-reduced-motion.png`: the settled screenshot
visibly shows buses 29/30 pulled outward from their isolated island, confirming the separation effect
actually reads as intended, not just passing assertions.

Test counts: 61/61 vitest, 96/96 e2e (+8 chapter4, +1 a11y), 32/32 pytest, clean build.

## Resume point if this session ends mid-chapter-work

Check `git log --oneline -10` for the most recent commit, and re-read this file plus
`docs/planning/cascadia/CHAPTER_ARCHITECTURE.md` and `docs/ART_DIRECTION.md` section 4 (storyboard/motion
table) by then. The shared GSAP lifecycle layer, the FULL intro sequence, `ChapterTitle`, and chapters
1-4 are built, reviewed, verified, and committed. Patterns every subsequent scene should follow, now
including chapter 4's own hard lesson:
- `useScene`, not raw `useGSAP`/`ScrollTrigger`. Every scene's `setup()` kills its own prior work
  FIRST (`gsap.killTweensOf()` for plain tweens, `tlRef.current?.kill()` for a one-shot timeline).
- **Never use GSAP's `x`/`y` (or any shorthand transform property) to "reset" an SVG element that
  already has a non-GSAP-owned `transform` attribute, and never assume `clearProps` reverses an
  attribute-level write** -- GSAP's x/y are ABSOLUTE positions, and its SVG support can write straight
  to the attribute rather than a CSS style. Capture the element's TRUE natural position in a `useRef`
  the FIRST time (and only time) a scene ever touches it, and always animate/reset relative to that
  captured value, never a fresh DOM read on a later run (which may already be corrupted, and React will
  not necessarily re-apply an unchanged prop value to fix it).
- **After any chapter's changes, re-run the FULL test suite, not just that chapter's own new tests,
  before trusting green** -- chapter 4's worst bug was caught by an unrelated, pre-existing touch test,
  not by chapter 4's own first-draft coverage.
- A scroll-scrubbed chapter (2 and 3's shared pattern) needs real scroll runway (`min-height: 200vh`)
  and a trigger `end` with a REAL, EMPIRICALLY-SWEPT margin before `useActiveChapter`'s own handoff
  point -- sweep scroll fraction vs. `data-active-chapter` directly, never assume a round number is
  safe. One `apply(progress)` function, called from both `onUpdate` and once immediately after
  `ScrollTrigger.create()`. A `FigIndex.tsx` `SCRUB_END_FRACTION` entry kept in sync with the trigger's
  own `end`. A one-shot (non-scrubbed) chapter re-fires its whole tween on a `resultKey` dependency
  change, not just on `active` entry, if its ledger/readout can change while already active (chapter 4's
  own pattern).
- Camera writes go through `claimCamera`; `Scene`'s own reset in `App.tsx` is in the render body, not a
  `useEffect` (React's layout-effects-before-passive-effects ordering is tree-wide, not parent-before-
  child).
- When a chapter's own content might visually collide with the persistent stage's current slot, MEASURE
  the slot's real rendered footprint and clear it with padding/alignment -- don't guess.
- A chapter whose own scene does real DOM measurement (`getScreenCTM`, `getBoundingClientRect`) needs a
  feature-detect guard so vitest/jsdom doesn't crash -- real-browser e2e is that scene's actual
  coverage.
- A performance measurement MUST include an idle-baseline control before concluding a kill-criterion
  "failure" reflects real app cost.

**Before trusting ANY chapter's visual, camera, or geometry state**, take and READ a real
(non-`fullPage`) screenshot at the chapter's actual scroll position, cross-check the specific thing
that matters via direct `evaluate`/`getAttribute`/SVG-property reads, AND re-run the full test suite --
every real bug found across chapters 1-4 (the background bug, the effect-ordering bug, two unreachable-
end-state bugs, the stale-tween bug, two layout-collision bugs, and the collapse-to-origin bug, the
worst of them) was invisible to a quick glance and only surfaced by checking actual DOM/computed state,
a genuinely independent review, or the full suite -- never assumed from reading the code or trusting
one chapter's own green tests in isolation.

## Chapter 5 ("Recovery plans") landed

Comparative view: three equal columns, one per top-ranked restoration sequence from CAS-INT-006's own
`state.restoration.ranking` (never a second, duplicated ranking computation), each a mini `NetworkView`
plus a served-MW step chart on a shared y-axis, a step control advancing all three in sync.
`NetworkView.tsx` already had `interactive: boolean` reserved for exactly this per earlier chapter-shell
work, confirmed by reading it before writing anything new.

**A real, additive architecture extension, not a redesign**: `removedBus` only ever supported ONE bus,
but a restoration scenario's `down` set can include MULTIPLE buses at once (the 'two_buses' preset).
Added `removedBuses?: number[]` to `NetworkView`'s props, unioned with the singular `removedBus`
everywhere it's checked (both the bus-removed flag and every line-adjacency "dead" check) -- backward-
compatible (defaults to `[]`), verified against the full suite before trusting it (97/97 e2e passed with
the extension in place, before chapter 5's own code even used it).

**An honesty call made explicit, not silently approximated**: `RestoreStep` (the real per-step data)
only carries AGGREGATE `served_mw`/`unserved_mw`, no per-bus or per-line detail -- there is no way to
know which SPECIFIC bus is shed at an intermediate restoration step without re-solving it (out of
scope). Rather than borrow baseline or live flow/shed data to fill in the mini networks (which would
show plausible-looking but WRONG per-bus detail for a scenario that was never actually solved at that
granularity), each mini network gets a minimal, honest `EMPTY_RESULT` (empty shed/islands/flows/
binding_lines) -- it shows ONLY the one thing actually known (which `down` elements are still down,
via `removedBuses`/`disabledLines`, derived from `RestoreSeq.order`/`steps[].restored`, which are
INDICES into the preset's own `down` array, not raw ids -- confirmed by reading `engine/dcopf.ts`'s own
`restorationSequence` comment before assuming the semantics). The real aggregate number is shown
separately and accurately in the step chart/label.

Step advance is plain React state (`useState`), not a GSAP scene: the motion table's own trigger for
this chapter is "User presses STEP... not scroll," discrete and user-driven, closer to a feedback
transition than continuous motion -- a CSS `transition: height 480ms` on each step-chart bar (matching
the table's "state 480ms" row) is the whole motion surface, disabled under `prefers-reduced-motion`
same as every other CSS-transition-driven chrome element in this app.

Verified: the empty-state prompt before Compare has run (never fabricated columns), real ranked data
after Compare (step 0 shows IDENTICAL served MW across all 3 columns -- the same fault, before any
restoration, a real cross-check), the step control advancing/reversing/resetting all 3 columns in
lockstep, the final step matching each order's own `final_served_mw`, switching the fault-scenario
preset correctly reverting to the empty prompt (not stale columns from the old scenario), analytical-
state preservation (no Worker from scrolling alone -- CompareRestoration's own Worker is lazy, created
only on Compare), and reduced motion (instant bar transitions) -- `e2e/chapter5.spec.ts`, 7 tests. A
dedicated axe-core pass over the populated comparison (3 real mini networks + step chart) found zero
violations. Real screenshots at all 3 breakpoints: `verification/SCREENSHOTS/ch5-desktop-1440x900-
empty.png`, `ch5-desktop-1440x900-step2.png`, `ch5-tablet-768x1024.png`, `ch5-mobile-390x844.png`.

Test counts: 61/61 vitest, 105/105 e2e (+7 chapter5, +1 a11y), 32/32 pytest, clean build -- full suite
re-run before committing, per the lesson chapter 4 forced.

## Resume point if this session ends mid-chapter-work

Check `git log --oneline -10` for the most recent commit, and re-read this file plus
`docs/planning/cascadia/CHAPTER_ARCHITECTURE.md` and `docs/ART_DIRECTION.md` section 4 (storyboard/motion
table) by then. The shared GSAP lifecycle layer, the FULL intro sequence, `ChapterTitle`, and chapters
1-5 are built, reviewed, verified, and committed. Only chapter 6 (the laboratory) remains before
production performance measurement, independent review, and final acceptance.

Continue with chapter 6 ("scenario laboratory": immersive canvas with an anchored inspector rail,
ALREADY functionally complete -- it hosts all 7 controls at their `placement="lab"` mount and the stage
is already always-live there, per `App.tsx`'s own existing story/lab switch). This pass is motion-only,
per the motion table's row 6: trigger "Any control commit, then Worker result" drives "last result dims
to 60% while solving, then all changed elements transition together on result" (feedback 240ms, state
480ms) -- hook into the EXISTING `state.solve` status machine (`'idle'|'solving'|'error'`, already
driving `StatusRegion`/`RestorationStatusRegion`), dimming the stage to 60% opacity while `solve===
'solving'` and restoring it (with whatever changed elements the new result implies) once it resolves.
This is NOT new analytical work and does not need a new `ScrollTrigger`/one-shot timeline pattern --
it's a `useScene` scene (or even a plain CSS rule keyed on a `data-solving` attribute) reacting to
`active==='ch6'` plus `state.solve`, the simplest of the 6 chapters' own motion requirements. Verify a
live-control-during-motion scenario (the user's own standing concern from chapter 3, equally relevant
here): triggering a SECOND control change while the first's dim/restore feedback is still in flight
must not corrupt the feedback state or drop the newer result (this app's own existing concurrency
protections, e2e/concurrency.spec.ts, already cover the ANALYTICAL side of this -- chapter 6's own new
test should confirm the VISUAL feedback doesn't fight itself under the same conditions). Each chapter
verified (vitest + e2e covering entry/midpoint/exit/forward/reverse/instant-jump/interrupted/reduced-
motion/analytical-preservation/live-control-during-motion + real screenshots at all 3 breakpoints,
actually read, AND the full suite re-run) and committed.

## Chapter 6 ("Scenario laboratory") landed -- ALL SIX CHAPTERS NOW BUILT

Immersive canvas with the anchored inspector rail. Already functionally complete before this pass (all
7 controls at their `placement="lab"` mount, the stage already always-live there, per `App.tsx`'s
existing story/lab switch) -- this pass was motion-only: `Chapter6Scene.tsx`, hooking into the EXISTING
shared `state.solve`/`state.restoration.status` machines (no new analytical work), dims the stage to
60% opacity while any control's real Worker solve is in flight and restores it once the result lands
(feedback 240ms in, state 480ms out, per the motion table's own row 6). Reduced motion still reflects
the real dimmed/undimmed state, just without the animated transition -- "instant swap" means instant,
not skipped.

Verified the user's own standing concern once more, in its last and most general form: a SECOND
control committed while the FIRST's solve is still visibly in flight (dimmed stage) does not leave the
feedback stuck dimmed or fighting itself once both resolve -- confirmed both the visual settling AND
that the analytical result actually landed (`data-state="removed"`), not just that the animation looked
fine. Also verified: idle (full opacity), an interrupted transition (leaving chapter 6 mid-solve leaves
the stage fully visible elsewhere, not stuck dimmed on return), and analytical-state preservation (no
Worker from scrolling alone -- the lab's Worker is lazily created only on a real control commit, same
pattern as every other chapter's own check). `e2e/chapter6.spec.ts`, 6 tests. A dedicated axe-core pass
over all 7 dual-mounted controls together found zero violations. Real screenshots (idle, mid-solve with
a real 1.5s WASM-load delay to make the dim state reliably reproducible, reduced-motion, all 3
breakpoints): `verification/SCREENSHOTS/ch6-desktop-1440x900-idle.png`, `ch6-desktop-1440x900-
solving.png`, `ch6-reduced-motion-solving.png`, `ch6-tablet-768x1024.png`, `ch6-mobile-390x844.png` --
the solving screenshot visibly shows the whole network dimmed with "Solving island-aware DC-OPF in
Worker..." text and disabled Confirm/Cancel buttons, confirming the feedback reads as a real, coherent
signal, not just a passing assertion.

One locator bug caught and fixed before trusting this chapter's own tests: `lab(page).locator(
'select').first()` was assumed to hit AlterCapacity's line select, but `RemoveNode` ALSO renders its
own `<select>` (in addition to SVG bus selection) and comes first in DOM order -- the test was silently
selecting the wrong control's dropdown. Fixed by using the established `controlLab(page, label)`
scoping helper instead of a bare `.first()`, the same lesson this project's locator-migration pass
already learned once and documented in `e2e/helpers/placement.ts`'s own comments; re-learned here
because a NEW test write didn't apply it, not because the helper itself was wrong.

Test counts: 61/61 vitest, 112/112 e2e (+6 chapter6, +1 a11y), 32/32 pytest, clean build -- full suite
re-run before committing.

## Resume point: all 6 chapters complete -- final-phase work remains

Check `git log --oneline -12` for the most recent commit, and re-read this file plus
`docs/planning/cascadia/CHAPTER_ARCHITECTURE.md` and `docs/ART_DIRECTION.md` section 4 by then. The
shared GSAP lifecycle layer, the full intro sequence, `ChapterTitle`, and all 6 chapters (1 "Grid
formation" through 6 "Scenario laboratory") are built, reviewed, verified, and committed. CAS-MOTION-001
(the intro + 6 chapters, captured at every breakpoint with reverse-scroll/reduced-motion variants) is
now substantively complete at the chapter level -- update its `status` in `specifications/
REQUIREMENTS.yaml` once the remaining phase-6/phase-8 work below closes it out formally.

**Remaining work, in the order the directive itself specifies (phases 6-8), none of it started yet:**

1. **Full-suite production frame-pacing measurement**, all 6 chapters' heaviest interactions together
   against the REAL production build, glow on -- not a substitute for chapter 3's own already-complete,
   isolated measurement (`verification/PERFORMANCE/CH3_FRAMEPACING_REPORT.md`), a NEW, broader pass.
   Candidates for "heaviest interaction" per ART_DIRECTION.md section 4's own kill-criterion wording
   ("chapter 4 fracture + a lab node removal, glow on"): chapter 4's single-shot tween (crossfade +
   island-separation, now real code to measure, not hypothetical) and chapter 6's own node-removal
   solve+dim-feedback case. Reuse `measure_ch3_framepacing.mjs`'s pattern directly: an idle-baseline
   control run through the IDENTICAL sampling method is mandatory before concluding any kill-criterion
   "failure" reflects real app cost, not environment noise (confirmed necessary once already, in
   chapter 3's own report -- the lesson generalizes, don't re-skip it here).
2. **Independent adversarial review in an isolated worktree**, per the directive's phase 6. Treat this
   as substantively necessary, not a formality: this session's own self-review process found 2 serious
   architecture bugs across 6 chapters (the camera-ownership effect-ordering bug in chapter 2, and the
   collapse-to-origin GSAP transform bug in chapter 4, this project's worst defect so far) -- a
   genuinely independent reviewer, with no stake in any of this code having already been "approved,"
   should be expected to find more, especially in chapter 3's corridor-strip geometry math and chapter
   5's restoration-index bookkeeping, the two most intricate pieces of new logic this pass added. Fix
   any P0/P1 found, add regression coverage, re-run the affected suite before re-approving.
3. **Final release readiness (directive phase 8):**
   - Full test suite one more time: analytical (pytest), unit (vitest), e2e (Playwright), accessibility
     (axe-core, already run per-chapter above but worth one more full pass), concurrency
     (`e2e/concurrency.spec.ts`, already green but re-confirm nothing in chapters 3-6 regressed it).
   - Responsive and reduced-motion verification: this pass's own per-chapter screenshots cover entry/
     key-state for each chapter at 3 breakpoints, but a final pass should verify the FULL scroll journey
     (intro through chapter 6) at each breakpoint in one continuous pass, not just per-chapter
     snapshots -- and confirm the still-open, already-tracked portrait-layout gap (chapters 2/3/4/5
     currently reuse scaled-down landscape coordinates, not a true portrait re-projection like chapters
     1/6 already have) doesn't block acceptance, or explicitly document it as a known limitation if it
     remains out of scope.
   - Requirement-coverage pass against `specifications/REQUIREMENTS.yaml`: update CAS-MOTION-001's
     status/evidence_paths (now substantively done), and CAS-RELEASE-001 (`unstarted` as of the last
     read -- production build verification, Pages base path, a deployed smoke test, honest
     `LIMITATIONS.md`) once deployment is actually authorized.
   - `LIMITATIONS.md`: add every deliberate simplification this pass documented and left honestly
     unfixed, not silently dropped -- chapter 3's own-rating-normalized flow bars (not a cross-rail MW
     scale), chapter 4's single-tween island-separation-without-a-literal-before-state (the same
     technique as the intro's own beat 4), chapter 5's `EMPTY_RESULT` mini networks (aggregate-only
     step data, no per-bus detail at intermediate restoration states), and the portrait-layout gap
     above.
   - Parent portfolio directive's doc-file list (README/ARCHITECTURE/VISUAL_DESIGN/MOTION_SYSTEM/
     DATA_SOURCES/TESTING/LIMITATIONS/DEPLOYMENT.md) -- check which exist already vs. still need
     writing; none of this session's work touched them, so assume they need a pass reflecting
     everything built across chapters 1-6.
   - Portfolio case-study integration and final acceptance report, per the directive's own closing
     steps -- the literal last items, after everything above is genuinely evidenced, not claimed.

**Do not claim performance compliance, requirement completion, or final acceptance without the actual
evidence each item above requires. Do not deploy or publish externally without explicit authorization.**

## Finalization phase 1-3 landed (performance measurement + documentation)

**Full-suite production frame-pacing measurement** (`verification/PERFORMANCE/
measure_full_suite_framepacing.mjs`, `FULL_SUITE_FRAMEPACING_REPORT.md`): forward scroll, reverse
scroll, rapid navigation, chapter 3's corridor morph (integrated, not isolated), chapter 4's fracture
tween, chapter 6's solving feedback (real 1.2s WASM delay), and a live solver update firing DURING
chapter 4's own motion (the combined worst case) -- all against the production build, glow on, idle
baseline + mobile/4x-throttled profiles. Every desktop scenario clustered within a 0.4ms band regardless
of workload; confirmed via an `about:blank` control (zero app code) that this is the test environment's
own render-timing floor (headless Chromium, no real display compositor), not application cost -- the
SAME conclusion chapter 3's own earlier isolated measurement reached, now re-confirmed at full-experience
scale with an even more direct control. The mobile/4x-throttled profile (ART_DIRECTION.md's own stated
primary target) passes every scenario with real margin. Also checked: repeated full-journey navigation
(3 cycles through all 7 chapter sections) creates zero stray solver Workers, confirming the per-chapter
"no Worker from scrolling alone" guarantee holds in aggregate, not just per-chapter in isolation.

**Independent adversarial review commissioned**: a fresh agent (no access to this file, briefed only
from CLAUDE.md/ART_DIRECTION.md/REQUIREMENTS.yaml/DESIGN_SYSTEM.json and the actual running production
build) launched in an isolated git worktree, per the directive's own requirement that the reviewer not
rely on the implementing agent's conclusions. Findings pending -- see the NEXT update to this file for
the outcome and any fixes it required. Do not treat chapter work as independently verified until that
update exists.

**Release documentation** (`README.md` rewritten -- was still the unmodified Vite template placeholder;
new `ARCHITECTURE.md`, `VISUAL_DESIGN.md`, `MOTION_SYSTEM.md`, `DATA_SOURCES.md`, `TESTING.md`,
`LIMITATIONS.md`, `DEPLOYMENT.md`): each points back to its own real source of truth
(`ART_DIRECTION.md`, `DESIGN_SYSTEM.json`, `DATA_CONTRACT.yaml`) rather than duplicating it.
`LIMITATIONS.md` consolidates every deliberate simplification from chapters 3-6 plus the performance
measurement's own environment-floor finding. `specifications/REQUIREMENTS.yaml` updated: CAS-UX-001 and
CAS-MOTION-001 both moved to `implemented` (their blocking items are now real), explicitly NOT marked
`independently verified` pending the review above. CAS-RELEASE-001 stays `unstarted` for the actual
deploy (not authorized) but now notes the production build and `LIMITATIONS.md` are both already done.

**Shared work still unbuilt, tracked here rather than silently dropped:** a mobile bottom-sheet pattern
for controls (chapters 2/3/5/6 all need one per ART_DIRECTION.md's responsive table; none exists yet).

**Independent review findings and remediation (phase 2, complete):** the review (isolated worktree,
no access to this file) found 4 items:

1. **[P1, FIXED]** Chapter 6's inspector rail had zero ch6-specific CSS: its 7 control cards sat in
   normal document flow, transparent, scrolling up over the full-bleed sticky network for the whole
   section at every breakpoint. Fixed in `experience.css` with a right-anchored rail at desktop
   (opaque background, its own internal scroll) and a stacked-below layout at tablet/mobile, matching
   ART_DIRECTION.md row 6 ("immersive canvas with anchored inspector") literally. **First attempt used
   `position: fixed`, which was itself a real regression**, found only by re-running the FULL suite
   (not just chapter 6's own tests) after the fix: a fixed descendant positions against the real
   browser viewport unless an ancestor establishes a containing block, so the rail rendered pinned on
   top of the ENTIRE page at every scroll position, intercepting clicks meant for chapters 1-5's own
   'home' controls (8 unrelated e2e tests failed: addLine, concurrency, dualMount, newControls -- all
   passed on a clean `git stash` of the same commit, confirming causation before the second fix).
   Corrected to `position: sticky` + `align-self: flex-end` within ch6's own flex-column section,
   which stays correctly bounded to that section. Visually reverified via real (non-fullPage)
   screenshots at all 3 required breakpoints after EACH attempt, and a regression test added
   (`e2e/chapter6.spec.ts`, "layout" describe block: desktop checks the rail is opaque/anchored per
   the spec's own intentional-overlay design, tablet/mobile check zero overlap with real bus elements,
   matching ART_DIRECTION.md's own responsive table which has no overlay allowance there).
2. **[test bug, FIXED]** `e2e/compareRestoration.spec.ts`'s isolation test asserted on the shared-stage
   `data-bus="26"` attribute without first navigating to chapter 4 (RemoveNode's own 'home' placement),
   per `CHAPTER_ARCHITECTURE.md` section 3's rule that the stage only shows a control's live effect
   while that control's own chapter is active. The underlying app behavior was already correct --
   fixed by adding `scrollToChapter(page, "ch4")` before the assertion, the same pattern already used
   everywhere else.
3. **[P2, FIXED in a second pass]** Intro title overlaps network glyphs under reduced motion.
   Initially mischaracterized above as "brief, transient, one-frame" without having actually
   reproduced it -- an `advisor` review of this remediation itself flagged that claim as unverified.
   Reproducing it properly (a real scroll sweep, not a single screenshot) showed the overlap across a
   wide scroll range (roughly scrollY 900-1700 at 1440x900), not a single frame. Fixed with an opaque
   `.intro-title-plate` wrapper around the title/subhead (`experience.css`), the same pattern already
   proven for chapter 1's `LegendPlate`. `LIMITATIONS.md`'s entry for this was removed (fixed, not
   deferred). The two OTHER apparent overlaps that review flagged (tablet ch2, desktop ch4) were
   investigated separately and genuinely were scroll-test artifacts -- that part of the original
   finding held up.
4. **[stale, already resolved]** Missing docs/stale `REQUIREMENTS.yaml` -- this finding predates the
   documentation commits made earlier in finalization (the review's worktree was checked out before
   those commits existed). No action needed.

**A second advisor review of this remediation itself (not the original independent review) caught 3
more real problems in what was about to be called done, before any acceptance report was written:**

- The chapter 6 fix above (`position: sticky` + `align-self: flex-end`) left a 160px gap between the
  rail and the real viewport edge (`main`'s own sp-9 padding plus `.chapter-section`'s own sp-8
  stacked, uncancelled) -- and covered an interactive bus (26) that a properly flush rail would have
  cleared. The desktop bus-overlap test had been LOOSENED to accept this rather than fixed, which is
  exactly the "weaken tests to get green" failure mode the directive prohibits. Fixed with a
  breakpoint-matched negative margin cancelling both paddings, and the chapter title was moved inside
  the rail as its own header (freeing the space it previously needed). The desktop test was restored
  to strict (zero bus overlap), now passing for real.
- The intro P2 above (item 3) was initially documented as fixed-later rather than actually
  investigated -- the same review caught that "brief/transient" was an unverified characterization.
- The prior commit message claimed "Playwright 115/115" when the actual run was 114/115 with one
  flake not run down. Re-verified: the flake reproduces as parallel-worker contention (passes 3x
  serially with `--workers=1`), not a real race, and the NEXT commit's numbers (116/116, including the
  new intro regression test) are taken from an actual fresh full run, not asserted.

Every test added or changed across both remediation passes was confirmed to FAIL against the
pre-fix code first (`git stash` the fix, rebuild, rerun, confirm red, `git stash pop`), not just
written to pass against the already-fixed state -- per the directive's own
reproduce-before-fix requirement.

**Full suite re-run fresh after BOTH remediation passes**: `npx tsc --noEmit` clean, Vitest 61/61,
pytest 32/32, Playwright 116/116 (single fresh run, no flakes this time). Production build clean.
Both remediation commits are on `main`.

**Third independent review (fresh worktree, verifying the two remediation commits above, not the
original P1/P2 findings) found one more real defect, now fixed:** desktop (flush rail, opaque, no bus
occlusion) and the intro title plate (opaque across a full scroll sweep) were both confirmed correct.
But the `<1023px` reset for `#ch6 .chapter-controls-column` was missing 2 of 9 desktop-only properties
(`align-self: flex-end`, a desktop-only negative `margin-right`) -- caught by a real scroll-THROUGH
sweep (4 depths), not the single arrival-frame check the existing tests used. Left in place, this
caused genuine horizontal overflow (864px content in a 768px tablet viewport, 518px in 390px mobile --
clipping real control text/buttons) and a PERSISTENT overlay over the network for most of the rail's
scroll length at tablet/mobile, where the spec requires clean stacking with zero overlap. Fixed by
explicitly zeroing both missed properties; a scroll-sweep regression test added (confirmed red against
the pre-fix CSS first, matching the reviewer's own overflow numbers almost exactly). The ~10px overflow
measured at mobile turned out to be a pre-existing, unrelated FIG-index nav artifact also present on
chapter 1 -- confirmed, not fixed (outside this task's scope), and the new test's tolerance accounts
for it explicitly rather than silently passing through a looser bound.

**Full suite re-run fresh after all THREE remediation passes**: `npx tsc --noEmit` clean, Vitest
61/61, pytest 32/32, Playwright 118/118. All three remediation commits are on `main`.

## Resume point: finalization in progress

Check `git log --oneline -15` for the most recent commit. All 6 chapters are built and committed.
Finalization phases 1 (performance), 2 (independent review + three remediation passes, the last of
which was itself independently reverified in a fresh worktree), and 3 (documentation) are now complete
and committed. Remaining: phase 4 (final integration gate: fresh runs of everything one more time,
oracle parity, responsive screenshots, integrated frame-pacing, concurrency/reset regressions) and
phase 5 (the final acceptance report, `verification/CASCADIA_FINAL_ACCEPTANCE_REPORT.md`, not yet
created, plus `CASCADIA_FINAL_HANDOFF.md` per the accelerated-finalization directive). Do not write
either report, and do not declare CASCADIA accepted, until phase 4's fresh evidence is in hand.
