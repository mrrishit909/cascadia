import { useGSAP } from '@gsap/react'
import { useEffect, useRef } from 'react'
import { ScrollTrigger, gsap } from './gsapSetup'

export interface SceneTools { gsap: typeof gsap; ScrollTrigger: typeof ScrollTrigger; reducedMotion: boolean }

const killSceneTriggers = (sceneId: string) =>
  ScrollTrigger.getAll().filter(st => typeof st.vars.id === 'string' && st.vars.id.startsWith(sceneId)).forEach(st => st.kill())

// Shared scene-lifecycle wrapper (cinematic-motion directive phase 2). Every chapter/intro-beat scene
// goes through this, never calls `useGSAP`/`gsap.context`/`ScrollTrigger.create` directly, so lifecycle
// correctness (StrictMode double-invoke safety, cleanup, scoping) is enforced in ONE place instead of
// re-derived per scene.
//
// - Scoping: `useGSAP`'s own `scope` option restricts GSAP's internal selector text lookups AND
//   guarantees every plain tween/timeline created during `setup()` is tracked and reverted together on
//   cleanup.
// - Reduced motion: `reducedMotion` is passed into `setup()` so each scene can choose its own meaningful
//   static end-state rather than this layer silently skipping `setup()`.
// - `sceneId` tags every ScrollTrigger this scene creates (the scene author's own responsibility inside
//   `setup()`, convention: ids starting with `${sceneId}`).
//
// Ref-timing safety net: a scene is routinely rendered as a sibling (or otherwise non-ancestor) of the
// DOM node its `scopeRef` points at (e.g. IntroBeat1 reaching into the shared persistent stage it
// doesn't render itself). Confirmed directly, twice, in this project's own tests: a child/sibling
// component's layout effect can run before a DOM node elsewhere in the SAME commit has had its ref
// attached, under React 19.3.0 -- not merely a JSX-ordering mistake fixed once (App.tsx's own comment on
// IntroBeat1's placement documents that fix), but the SAME failure reproduced again in complete
// isolation with no ordering mistake to find. Rather than keep re-deriving "which JSX order makes this
// work," this shared wrapper retries on the next animation frame if `scopeRef.current` is null when
// `setup()` would otherwise run, bounded and cancelled on unmount -- converges within a frame or two in
// practice, and makes every scene built on this hook robust against the timing question instead of
// each one needing to get JSX order exactly right.
//
// StrictMode AND unmount cleanup, verified directly rather than assumed, two real gaps found by writing
// this project's own regression tests before trusting the library:
// 1. `useGSAP` is GSAP's documented StrictMode-safe React integration, but under this project's
//    installed versions (React 19.3.0, @gsap/react 2.1.2) it still left a DUPLICATE ScrollTrigger behind
//    after a StrictMode mount in an isolated repro -- whatever the exact cause, this wrapper doesn't
//    depend on it: every `setup()` call starts by killing any existing ScrollTrigger whose id starts
//    with `sceneId`, so a duplicate invocation converges to exactly one trigger instead of accumulating.
// 2. `useGSAP`'s own unmount cleanup calls `context.revert()`, which -- traced directly in
//    node_modules/gsap/gsap-core.js -- calls `this.kill(config || {})` with an always-truthy `{}`
//    argument, which takes `Context.kill`'s "soft revert" branch (`t.revert(revert)` on tracked
//    non-Tween/Timeline entries) rather than the "actually remove it" branch
//    (`this.data.forEach(e => e.kill && e.kill())`, only taken when `kill()`'s first argument is
//    falsy). Confirmed directly: a ScrollTrigger created inside a `useGSAP` context survives
//    `context.revert()` and still appears in `ScrollTrigger.getAll()` afterward, in both the StrictMode
//    and plain-unmount cases, with or without this wrapper. This wrapper therefore does NOT rely on
//    `useGSAP`'s automatic cleanup for ScrollTrigger disposal at all -- a separate, plain `useEffect`
//    with its own cleanup explicitly `.kill()`s every ScrollTrigger tagged with this `sceneId` on
//    unmount, which IS the correct, verified-working removal path.
export function useScene(
  sceneId: string,
  scopeRef: React.RefObject<Element | null>,
  setup: (tools: SceneTools) => void,
  deps: unknown[] = [],
) {
  const reducedMotion = useRef(
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  ).current
  // Tracked OUTSIDE useGSAP's own callback/cleanup machinery deliberately: this project already found
  // useGSAP's automatic cleanup unreliable for ScrollTrigger disposal (see the comment above), so the
  // retry's own teardown goes through the SAME plain `useEffect` below that's already verified to run
  // on every unmount, not through useGSAP's.
  const rafRef = useRef(0)
  useGSAP(() => {
    const run = () => {
      if (!scopeRef.current) { rafRef.current = requestAnimationFrame(run); return }
      killSceneTriggers(sceneId)
      setup({ gsap, ScrollTrigger, reducedMotion })
    }
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, { scope: scopeRef, dependencies: deps })
  useEffect(() => () => { cancelAnimationFrame(rafRef.current); killSceneTriggers(sceneId) }, [sceneId])
}
