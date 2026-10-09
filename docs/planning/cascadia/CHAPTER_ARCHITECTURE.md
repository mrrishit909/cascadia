# CASCADIA chapter architecture: resolved decisions

Written during the architecture-stabilization pass (before any chapter/scroll code exists), per the
user's explicit instruction to document true contradictions between `docs/ART_DIRECTION.md` and the
verified frontend architecture before building further. Read `execution/PROGRESS.md` for the current
build state.

## 1. The story/lab boundary (load-bearing, referenced throughout the codebase from here on)

**Scroll-driven chapter state must NEVER call the shared Worker/lpClient.** A scroll-triggered solve
would supersede a user's in-flight real solve -- this is the exact hang class already proven and fixed
once (CompareRestoration's Worker isolation, `verification/M4_WAVE1_INDEPENDENT_REVIEW.md` and
`verification/M4_INT004_006_INDEPENDENT_REVIEW.md`). Concretely:

- Chapters 1-5's own narrative content (the fault/recovery states the ART_DIRECTION.md motion sheet
  describes) comes from **oracle-generated, labeled, precomputed fixtures** -- the same pattern as
  `public/data/precomputed/*.json`, versioned and checksummed like the existing baseline/islanding/
  infeasible fixtures. Scrolling through a chapter swaps between these FIXED, pre-solved states. It
  never calls `solve()`/`removeBus()`/`compareRestoration()` etc.
- The 7 interaction controls (home chapter + chapter 6 lab, per the chapter table below) are the ONLY
  thing that mutates live `AppState` via the real Worker. They are explicitly NOT scroll-triggered --
  a user action (click/tap/key), never a `ScrollTrigger` callback, is what may call into `state.tsx`'s
  `removeBus`/`setCapacity`/`setLoadScale`/`setGenPmax`/`setLineOutage`/`setAddedLine`/
  `compareRestoration`.
- **No displayed number may tween.** This was already a hard rule (`docs/ART_DIRECTION.md`'s global
  motion rule 1, matching this repo's own long-standing "no `Date.now()`/`Math.random()`/animation-
  progress feeding a displayed value" rule). Animate stroke/color/opacity/transform between states;
  swap number text discretely at the end of a transition.

## 2. Resolved contradiction: "one persistent SVG stage" vs. chapter 3's inset / chapter 5's minis

`docs/ART_DIRECTION.md` section 4 states the SVG stage "is never torn down and replaced" across intro
and all 6 chapters, but section 3's chapter table also specifies:
- Chapter 3 (capacity bottlenecks): a small **locator inset** (20% width, top) showing the whole
  network, alongside a non-network "corridor strip" of rails as the main content.
- Chapter 5 (recovery plans): **three mini networks**, one per restoration-sequence column, as small
  multiples with a shared served-MW axis.

Both of these put a second (or fourth) `<svg>` on the page at the same time as the main stage.
Literally one persistent element cannot also be three simultaneous elements.

**Resolution:** "the stage" means the single **interactive, canonical** NetworkView instance --
the one with `role="button"`/`tabIndex`/`data-testid="bus"`/`"line"` hit targets, keyboard navigation,
selection, and the glow filter driven by live solver state. That instance persists (mounts once, stays
mounted, changes only via transform/camera, never remounts) across the intro and all 6 chapters,
including chapter 6's laboratory.

Chapter 3's locator inset and chapter 5's mini networks are a **separate, non-interactive presentational
variant** of the same renderer: no `role="button"`, no `tabIndex`, no `data-testid="bus"`/`"line"`
(use a different testid prefix, e.g. `data-testid="mini-bus"`), reduced DOM (no focus-ring elements, no
selection-bracket elements -- those only make sense on the one keyboard-navigable stage). This is a
real constraint, not a shortcut: without it, every `[data-testid="bus"][data-bus="26"]` locator used
throughout the existing e2e suite would multi-match the instant chapter 3 or chapter 5 renders, and a
keyboard user tabbing through the page would hit up to 4 non-interactive copies of the network before
reaching anything useful.

**Implementation note for whoever builds this:** `NetworkView.tsx` likely needs an `interactive: boolean`
(default true) prop that, when false, strips the `role`/`tabIndex`/testid/focus-ring/selection-bracket
treatment from every bus and line, while keeping the exact same `lineVisual`/color/glow logic (so the
mini renders use the identical, already-independently-reviewed encoding, not a hand-rolled second copy
of it that could drift).

## 3. Resolved: what the stage shows in chapters 2-5 while live controls are also present

Chapters 2 (CAS-INT-002/003), 3 (CAS-INT-005), 4 (CAS-INT-001/007) and 5 (CAS-INT-006) each have BOTH
a story fixture (per section 1 above) AND a live control that mutates real `AppState`. These can
diverge: the story fixture shows a specific curated post-fault state; the user's own live interaction
in that chapter's control can produce a *different* result.

**Original resolution (superseded below, kept for history):** "the stage shows the chapter's story
fixture until `result !== baseline`, then shows the live result." Advisor review found this broken on
three counts before any chapter code existed:
- (a) `!==` is reference identity on a `DcopfResult` object. Apply a change, then apply the exact
  inverse (e.g. drag a capacity slider back to 1.00x and let it resolve), and the new solve produces a
  structurally-identical-but-freshly-allocated result object -- `!==` stays true forever, so the stage
  would stick on "YOUR SCENARIO" even though the scenario is back at baseline. The check needs to be a
  **value comparison against the chapter's own relevant fields**, not object identity.
- (b) The check was written against `AppState` globally, so it fires for ANY chapter once ANY one of
  them diverges -- editing chapter 3's capacity slider would also flip chapter 2's and chapter 4's
  stages to "YOUR SCENARIO" the next time the user scrolls past them, even though the user never
  touched those chapters' own controls.
- (c) Each chapter's control writes different fields, so "diverged" has to be chapter-scoped: chapter 2
  (CAS-INT-002/003) cares about `loadScale`/`genPmax`; chapter 3 (CAS-INT-005) cares about
  `lineCapacity`/`allowShed`; chapter 4 (CAS-INT-001/007) cares about `removedBus`/`disabledLines`.
  Chapter 5 (CAS-INT-006) is a different subsystem entirely (`AppState.restoration`, its own Worker) --
  its divergence condition is simply "has the user run at least one Compare" (`restoration.ranking !==
  null`), not a comparison against the main scenario's baseline at all.

**Actual resolution:** each chapter's divergence check is a **named, chapter-scoped predicate** over
only the fields that chapter's own control(s) can write, comparing against `state.baseline`'s value for
those same fields (plain value equality on numbers/booleans/sorted-array-contents, never object
identity):
- Chapter 2: `state.loadScale !== baseline.loadScale (per-bus) || state.genPmax !== baseline.genPmax (per-gen)`
- Chapter 3: `state.lineCapacity` has any key whose factor differs from 1, or `allowShed` differs from
  its default
- Chapter 4: `state.removedBus !== null || state.disabledLines.length > 0`
- Chapter 5: `state.restoration.ranking !== null`

Each chapter shows ITS OWN story fixture until ITS OWN predicate is true, independent of every other
chapter's state -- diverging chapter 3 never touches chapter 2's or chapter 4's displayed stage. Once a
chapter's predicate is true, that chapter's stage shows the live result, labeled "YOUR SCENARIO"; once
the predicate becomes false again (user reset, or reversed their own edit back to baseline), the stage
returns to the story fixture and the label reverts. This keeps the rule from section 1 intact (the
fixture transition itself is still not live-solved) while making a user's own action visibly take
effect immediately, scoped to the chapter that actually owns it.

## 4. Chapter table (from `docs/ART_DIRECTION.md`, repeated here for a single reference point)

| Ch | Name | Archetype | Hosted controls |
|---|---|---|---|
| 1 | Grid formation | Immersive canvas | none |
| 2 | demand and generation | Editorial split, prose-led | CAS-INT-002, CAS-INT-003 |
| 3 | capacity bottlenecks | Focused inspector (corridor strip + locator inset) | CAS-INT-005 |
| 4 | outage cascades | Editorial split, canvas-led, mirrored | CAS-INT-001, CAS-INT-007 |
| 5 | recovery plans | Comparative view (3 mini networks) | CAS-INT-006 |
| 6 | scenario laboratory | Immersive canvas + anchored inspector | all 7 |

## 5. Still open, not yet resolved (flag before building the affected piece)

- `RemoveNode.tsx` owns the single app-wide "Reset to baseline" button. If it's ever dual-mounted
  (home chapter 4 + lab chapter 6, matching every other control), that button duplicates and
  `getByRole('button', {name: 'Reset to baseline'})` locators across the e2e suite need scoping.
  Not yet an issue: nothing mounts RemoveNode twice today.
- The exact mechanism for detecting "current chapter" (for the story/lab divergence rule in section 3,
  and for ScrollTrigger wiring generally) isn't chosen yet -- likely a small piece of UI-only state
  (not `AppState`, which section 1 keeps scroll-free), e.g. a `useActiveChapter()` hook backed by
  `IntersectionObserver` or GSAP's own ScrollTrigger callbacks writing to a local ref/context, separate
  from the analytical AppState entirely.
