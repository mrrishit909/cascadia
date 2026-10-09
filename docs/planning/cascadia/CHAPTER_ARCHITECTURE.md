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

**Resolution:** the stage shows the chapter's story fixture **until the live scenario's confirmed state
diverges from baseline** (i.e. `result !== baseline` in `AppState` terms -- the same check
`AlterCapacity.tsx` already uses for its own resync logic), **at which point it shows the live result
instead**, labeled distinctly (e.g. a small "YOUR SCENARIO" tag near the legend plate, replacing
whatever story-fixture label was showing). Reset returns to the story fixture, not literally "baseline"
if the chapter's story fixture isn't the unmodified baseline.

This keeps the rule from section 1 intact (the fixture transition itself is still not live-solved) while
making a user's own action visibly take effect immediately, not get silently overridden by the next
scroll-triggered fixture swap.

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
