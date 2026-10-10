# Architecture

## The persistent stage

`src/visualization/NetworkView.tsx` renders the IEEE case30 network as ONE SVG component. It mounts
once (in `src/app/App.tsx`'s `Scene` component) and never remounts across the intro or any of the 6
chapters -- only its props change (`result`, `camera`, `removedBus`/`removedBuses`, `disabledLines`,
`selectedBus`/`selectedLine`, `interactive`). Each chapter's own "on-screen slot" (full-bleed,
55%-right, 20%-top-left-inset, etc.) is CSS, keyed on a `data-active-chapter` attribute
(`src/scenes/experience.css`) -- never a remount, never a second instance, except chapter 5's three
deliberately non-interactive "mini" instances (`interactive={false}`, used for small-multiple
comparison, never for the one canonical interactive stage) and chapter 3's locator inset, which is the
SAME instance, just scaled down via CSS `transform`.

`NetworkView` also supports a `removedBuses?: number[]` prop (in addition to the original singular
`removedBus`) for chapter 5's restoration mini-networks, which can have multiple down buses at once --
an additive, backward-compatible extension, not a redesign.

## Chapter composition and story/live divergence

`App.tsx`'s `Scene` component computes which result object the stage shows for the currently active
chapter: chapters 2-4 show a STORY fixture (a precomputed baseline-adjacent scenario) until the
chapter's own hosted control(s) genuinely diverge from their defaults (`src/app/chapterDivergence.ts`),
at which point the stage switches to the LIVE result and stays in sync with whatever the control itself
displays. Chapter 5's stage is inert (opacity 0, `pointer-events: none`) -- the 3 mini networks inside
its own content do the work. Chapter 6 (the laboratory) is always live; it has no story.

## Shared GSAP lifecycle (`src/scenes/useScene.ts`)

Every chapter/intro-beat scene goes through one shared hook instead of calling `useGSAP`/
`gsap.context`/`ScrollTrigger.create` directly:

- Kills any ScrollTrigger tagged with its own `sceneId` prefix at the start of every `setup()` call
  (found necessary directly: `useGSAP`'s own StrictMode handling left a duplicate ScrollTrigger behind
  in this project's React 19 + `@gsap/react` 2.1 combination).
- A separate, explicit unmount-cleanup effect `.kill()`s those same tagged triggers (found necessary
  directly: `useGSAP`'s own cleanup -- `context.revert()` -- takes a "soft revert" code path that does
  NOT remove a tracked ScrollTrigger from GSAP's own registry, traced in `gsap-core.js` before fixing).
- Retries on the next animation frame if its own `scopeRef` isn't attached yet (a scene can legitimately
  render as a sibling of the DOM node it needs, and React's commit-phase ref/effect ordering doesn't
  guarantee that node is attached first).

**Every scene's own `setup()` additionally kills its OWN prior non-ScrollTrigger work first** --
`gsap.killTweensOf()` for a plain tween/timeline, or (for `IntroSequence.tsx`'s one-shot 12s timeline) a
`tlRef` kept in a `useRef` and explicitly `.kill()`d. `useScene`'s own built-in cleanup only knows about
ScrollTrigger; a scene with its own timeline or tween is responsible for not leaving a stale one running
after a re-trigger (re-entering a chapter, a control change while already on that chapter, etc.) --
this was a REAL bug class, found twice independently (`IntroSequence`'s own beat timeline, and
`ChapterTitle`'s masked-reveal tween), not a hypothetical concern.

## Camera ownership (`src/scenes/presentationCamera.ts`)

A plain module-level store (not React Context -- there is genuinely one live camera for the one
persistent stage). `claimCamera(ownerId, activeChapterId, camera)` is the only way to change it, and
silently drops the write unless `ownerId === activeChapterId`, so a stale write from a scene that's no
longer active can never clobber the currently-active scene's own camera. `resetCameraToDefault
(activeChapterId)` restores the full default framing whenever the active chapter changes -- called from
`Scene`'s own RENDER BODY (a `useRef`-guarded synchronous call), not a `useEffect`. This is load-bearing:
React runs ALL layout effects (what `useGSAP` is built on) before ANY plain effect, across the WHOLE
component tree, regardless of parent/child nesting -- there is no ordering guarantee a parent's plain
`useEffect` can lean on to run before a child scene's own camera claim. A real bug (chapter 2's camera
claims being silently clobbered by App's own reset, which ran LAST despite being declared first in the
component) was found and fixed this way.

## Scroll-driven chapters (2 and 3)

A real `ScrollTrigger.create(...)` per scene, scoped via `useScene`. Two load-bearing lessons, found
empirically (scroll-fraction swept against `useActiveChapter`'s own `data-active-chapter` output), not
assumed:

- The default ~100vh chapter-section height leaves too little scroll DISTANCE for a trigger's own
  `end` to land before `useActiveChapter`'s independent IntersectionObserver hands off to the next
  chapter -- both scroll-scrubbed chapters use `min-height: 200vh` and an `end` tuned with a real
  measured safety margin (`'60% top'` for chapter 2, `'40% top'` for chapter 3), not a round-number
  guess.
- A scrubbed scene's `apply(progress)` function is called both from `onUpdate` (every real scroll tick)
  AND once immediately after `ScrollTrigger.create()`, so a user who arrives mid-range without a further
  scroll event (scrolling up from the next chapter, a keyboard jump) sees the correct state immediately,
  not a stale default that only updates on the next scroll.

`src/scenes/FigIndex.tsx`'s `SCRUB_END_FRACTION` map makes direct index-navigation land in each
scrub's own END state (per ART_DIRECTION.md's own "direct index navigation lands in the end state"
rule), kept in sync with each scene's own trigger `end`.

## One-shot chapters (intro, chapter titles, chapter 4, chapter 6)

A single `gsap.timeline()` (or a single `gsap.to`/`gsap.set` call) triggered on an `active`/`resultKey`
dependency change, not a ScrollTrigger scrub. Chapter 4's own crossfade technique -- fade the whole
stage out, let React's already-instant story/live swap happen while it's invisible, fade back in --
reuses the SAME pattern the intro's own beat 4 established for the identical underlying problem (a React
prop swap can't be intercepted mid-render to animate a literal "before" state).

## Analytical state vs. presentation state

`src/app/state.tsx` (`AppState`, a reducer) owns everything that affects a real LP solve: removed
buses/lines, load/generator/capacity overrides, the solver's own `idle|solving|error` status, pending
requests, epoch (for Reset-during-solve races). Presentation-only state that never touches the solver
(which chapter is active, whether the intro has been skipped, whether chrome has faded in, the current
camera) lives in small, separate module-level stores (`src/scenes/introFixtureState.ts`,
`introChromeState.ts`, `introSkipState.ts`, `presentationCamera.ts`) or local component state (chapter
5's step index). This separation is deliberate and enforced throughout: a scene's own motion code never
mutates `AppState`, and `AppState`'s reducer never knows anything about scroll position or camera
framing.

## Known architecture extension points (not built)

- A mobile bottom-sheet pattern for controls (ART_DIRECTION.md's own responsive table calls for one in
  chapters 2/3/5/6; none exists yet -- controls currently just reflow into the mobile layout).
- True portrait-specific layout coordinates for chapters 2-5 (chapters 1 and 6 already have a real,
  separately-computed portrait projection via `NetworkView`'s `orientation="portrait"` prop; 2-5 reuse
  the scaled-down landscape layout instead).
