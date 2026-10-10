import { useScene } from './useScene'

const HERO_BUS = 0 // bus 0 hosts generator 0 (public/data/raw-metadata/case30.json), the network's slack bus

// Intro beat 1 (docs/ART_DIRECTION.md section 4's opening storyboard, 0-3s): "Ink field. The title
// plate is legible from frame 1. One generator bus ring lights copper with its halo." Mechanism per the
// storyboard: "opacity on the core ring, glow group pre-rendered."
//
// Acceptance-gate vertical slice (cinematic-motion directive phase 6): the first real scene built on
// the shared useScene/presentationCamera infrastructure (src/scenes/useScene.ts,
// src/scenes/presentationCamera.ts), verified thoroughly (forward, reverse, reduced-motion, StrictMode,
// cleanup, rapid-scroll convergence -- see src/scenes/IntroBeat1.test.tsx and e2e/introMotion.spec.ts)
// before the remaining beats/chapters are built on the same pattern.
//
// Design note, changed after two real bugs an e2e test caught: an EARLIER version drove this beat via a
// ScrollTrigger with `toggleActions`/`fastScrollEnd`, matching the scroll-scrub pattern chapters 2/3
// genuinely need. For a BINARY "are we at the intro or not" transition (not a continuous scrubbed
// value), that was the wrong tool -- confirmed directly: a programmatic/instant jump straight from the
// intro to chapter 6 left every non-hero bus permanently stuck at opacity 0 even with
// `fastScrollEnd: true`, because ScrollTrigger's own enter/leave pairing and timeline reverse-replay
// logic couldn't be made to converge reliably for an instant multi-chapter jump. Reworked to be driven
// directly by `active` (useActiveChapter's own IntersectionObserver-based detection, already hardened
// against the "stuck forever" bug class in a separate pass) instead of a second, competing scroll-
// position mechanism -- GSAP is still used for the actual tween (the glow growing in), just triggered by
// a React state transition rather than re-deriving scroll-position entry/exit logic a second time.
export function IntroBeat1({ stageRef, introRef, active }: { stageRef: React.RefObject<HTMLDivElement | null>; introRef: React.RefObject<HTMLElement | null>; active: string }) {
  useScene('intro-beat1', stageRef, ({ gsap, reducedMotion }) => {
    const stage = stageRef.current
    if (!stage || !introRef.current) return
    const allBuses = stage.querySelectorAll('[data-testid="bus"]')
    const allLines = stage.querySelectorAll('[data-testid="line"], [data-testid="candidate-line"]')
    const glowGroup = stage.querySelector('[data-testid="glow-group"]')
    const heroBus = stage.querySelector(`[data-testid="bus"][data-bus="${HERO_BUS}"]`)
    if (!heroBus) return
    const everything = [allBuses, allLines, glowGroup].filter(Boolean)

    // Convergence (phase 9: "the correct visual presentation must eventually converge to the active
    // chapter"; "no animation should leave controls permanently inaccessible or hidden"): once the
    // user has genuinely left the intro, force-clear the blackout outright -- deterministic, not
    // dependent on any tween having played to completion first.
    if (active !== 'intro') {
      gsap.set(everything, { clearProps: 'opacity,filter' })
      return
    }

    if (reducedMotion) {
      // docs/ART_DIRECTION.md global motion rule 5: reduced motion "loads the intro's final frame
      // directly" -- every element visible at full opacity, no blackout beat, no tween at all.
      gsap.set(everything, { opacity: 1, clearProps: 'filter' })
      return
    }

    gsap.set(allLines, { opacity: 0 })
    gsap.set(allBuses, { opacity: 0 })
    if (glowGroup) gsap.set(glowGroup, { opacity: 0 })
    // the hero bus is visible from frame 1 (a dim ring), its halo grows in over the tween -- not the
    // bus itself fading in, which the storyboard's "legible from frame 1" phrasing rules out.
    gsap.set(heroBus, { opacity: 1, filter: 'drop-shadow(0 0 0px #EF9C54)' })
    gsap.to(heroBus, { filter: 'drop-shadow(0 0 6px #EF9C54)', duration: 1.5, ease: 'power2.out' }) // glow.filter.maxHaloPx: 6
  }, [active])
  return null
}
