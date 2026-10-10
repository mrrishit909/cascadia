# Motion system

Source of truth: `docs/ART_DIRECTION.md` section 4 (the full motion sheet and per-chapter table). This
file summarizes what was actually built, file-by-file, with pointers into `execution/PROGRESS.md` for
the reasoning and bugs behind each decision.

## Global rules (load-bearing, checked in every scene)

1. **No count-up numbers.** Every displayed value swaps or cross-fades at a transition's end; it is
   never interpolated from animation progress, `Date.now()`, or `Math.random()`.
2. **Data drives animation, never the reverse.** Pulse direction is the real sign of the LP flow; pulse
   speed/bar length is proportional to a real magnitude.
3. **One persistent SVG stage** morphs across the intro and all 6 chapters. It is never torn down and
   replaced (see `ARCHITECTURE.md`).
4. **Every chapter defines entry, exit, and reverse.** Reverse scroll plays the inverse of whatever
   scrub is active; an interrupted transition (a fast scroll past, an instant FIG-index jump) kills the
   running tween and snaps to the target chapter's own correct end state -- verified per chapter, not
   assumed.
5. **Reduced motion** swaps every state instantly. For a chapter with its own distinct reduced-motion
   end state (the intro's own beat-4 end frame; chapter 2's "both stacks shown" composition), reduced
   motion shows THAT state, not just "the same thing, faster."

## The shared scene infrastructure

See `ARCHITECTURE.md`'s "Shared GSAP lifecycle" section. Two scene archetypes, used consistently:

- **Scroll-scrubbed** (chapters 2, 3): a real `ScrollTrigger`, `apply(progress)` called from both
  `onUpdate` and once immediately on creation, real scroll runway, an empirically-swept `end` margin.
- **One-shot** (intro, chapter titles, chapter 4, chapter 6): a single timeline or tween, triggered on
  an `active`/`resultKey` change, its own prior work killed first on every `setup()` call.
- Chapter 5's step advance is neither -- a plain button press driving React state plus a CSS
  `transition`, since its own motion-table trigger is explicitly "not scroll."

## Per-chapter summary

| Ch | Trigger | What moves | File |
|---|---|---|---|
| Intro | Time-based, one-shot (0-12s) | Blackout -> BFS-ordered line/bus assembly -> flow-direction pulses -> fault crossfade + chrome reveal | `src/scenes/IntroSequence.tsx` |
| 1 | Section enters | Masked title reveal (clip-path wipe) | `src/scenes/ChapterTitle.tsx` (shared by all 6 chapters) |
| 2 | Scroll scrub | Camera pan (`lerpCamera`, `presentationCamera.ts`) + a generation/demand balance-rule crossfade | `src/scenes/Chapter2Scene.tsx` |
| 3 | Scroll scrub | Real measured line geometry (`getScreenCTM` + `DOMPoint` transforms off the live `<line>` DOM) morphs into horizontal corridor rails | `src/scenes/Chapter3Scene.tsx` |
| 4 | Single trigger (re-fires on any displayed-scenario change, not just entry) | One 700ms whole-stage crossfade wrapping the instant story/live swap, plus isolated-island buses nudging 24px outward from the network centroid | `src/scenes/Chapter4Scene.tsx` |
| 5 | User presses Step (not scroll) | All 3 comparison columns advance one restoration step together; CSS `transition: height 480ms` on each step-chart bar | `src/scenes/Chapter5Comparison.tsx` |
| 6 | Any control commit, then Worker result | Stage dims to 60% opacity while `state.solve==='solving'`, restores on result | `src/scenes/Chapter6Scene.tsx` |

## Hard-won lessons (see `execution/PROGRESS.md` for full detail)

- **A superseded one-shot timeline left running after its own trigger condition changes is a real bug
  class**, found twice independently (the intro's own beat sequence, then `ChapterTitle`'s masked
  reveal): `useGSAP`'s automatic cleanup does not revert a running tween just because a dependency
  changed again before it finished. Every one-shot scene now kills its own prior work (`killTweensOf`
  or an explicit `tlRef.kill()`) as the first line of `setup()`.
- **GSAP's `x`/`y` properties are ABSOLUTE positions, not relative offsets** -- this project's single
  worst bug (chapter 4's island-separation nudge, which briefly collapsed the entire 30-bus network to
  the SVG origin on every page load) came from treating `{x:0, y:0}` as "no additional offset." The fix
  pattern now used everywhere a scene needs to "reset" an SVG element it has animated: capture the
  element's TRUE natural position once, in a `useRef`, the first time the scene ever touches it, and
  always compute relative to that captured value -- never re-derive "natural" from a DOM that scene may
  have already modified.
- **A scroll-scrubbed chapter's default section height is not enough runway** for its own
  `ScrollTrigger` to reach progress=1 while `useActiveChapter`'s independent IntersectionObserver still
  considers it the active chapter -- found and fixed for both chapter 2 and chapter 3 by sweeping real
  scroll fraction against `data-active-chapter`, never assumed from a round-number guess.
- Every real bug across all 6 chapters was caught by taking and READING a real (non-`fullPage`)
  screenshot at the chapter's actual scroll position, cross-checking the specific DOM/computed-style
  fact that mattered, and re-running the FULL test suite after each chapter (not just that chapter's own
  new tests) -- the worst bug above was caught by an unrelated, pre-existing touch-interaction test, not
  by the chapter's own first-draft coverage.
