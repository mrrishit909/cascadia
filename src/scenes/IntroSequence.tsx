import { useEffect, useRef } from 'react'
import { useScene } from './useScene'
import { setIntroFaultActive } from './introFixtureState'
import { setIntroChromeVisible } from './introChromeState'
import { useIntroSkipped } from './introSkipState'
import type { Case30 } from '../engine/types'

const HERO_BUS = 0 // bus 0 hosts generator 0 (public/data/raw-metadata/case30.json), the network's slack bus
const DRAW_PROPS = 'strokeDasharray,strokeDashoffset' // what DrawSVGPlugin actually writes inline (confirmed in node_modules/gsap/DrawSVGPlugin.js) -- clearProps: 'drawSVG' is not a real CSS prop and clears nothing

// docs/ART_DIRECTION.md section 4's opening storyboard (0-12s), four beats on the ONE persistent stage:
//   0-3s   blackout, single energized node       (beat 1)
//   3-6s   lines assemble (BFS from the hero bus) (beat 2)
//   6-9s   demand currents pulse                  (beat 3)
//   9-12s  fault interrupts, controls emerge       (beat 4)
// Built on the shared useScene/presentationCamera infrastructure verified in the earlier acceptance-gate
// pass (src/scenes/useScene.ts); beat 1's own hard-won fixes (active-driven convergence instead of
// ScrollTrigger toggleActions, the ref-timing retry) are the foundation every beat below reuses.
//
// Standard breadth-first search over the real network graph (not DOM inference -- `network` is passed
// in specifically so this can compute a true topological order), producing the order in which each line
// is first encountered expanding outward from the hero bus, and the order each bus is first reached.
function bfsFromHero(network: Case30, startBus: number): { lineOrder: number[]; busOrder: number[] } {
  const adj = new Map<number, { lineIdx: number; bus: number }[]>()
  const addEdge = (a: number, lineIdx: number, b: number) => { if (!adj.has(a)) adj.set(a, []); adj.get(a)!.push({ lineIdx, bus: b }) }
  for (const l of network.lines) { addEdge(l.from_bus, l.idx, l.to_bus); addEdge(l.to_bus, l.idx, l.from_bus) }
  const visitedBuses = new Set([startBus])
  const visitedLines = new Set<number>()
  const lineOrder: number[] = []
  const busOrder: number[] = [startBus]
  const queue = [startBus]
  while (queue.length) {
    const bus = queue.shift()!
    for (const { lineIdx, bus: next } of adj.get(bus) ?? []) {
      if (visitedLines.has(lineIdx)) continue
      visitedLines.add(lineIdx)
      lineOrder.push(lineIdx)
      if (!visitedBuses.has(next)) { visitedBuses.add(next); busOrder.push(next); queue.push(next) }
    }
  }
  return { lineOrder, busOrder }
}

export function IntroSequence({ stageRef, introRef, active, network, flows }: {
  stageRef: React.RefObject<HTMLDivElement | null>
  introRef: React.RefObject<HTMLElement | null>
  active: string
  network: Case30 | undefined
  flows: Record<string, number> | undefined
}) {
  const skipped = useIntroSkipped()
  const tlRef = useRef<gsap.core.Timeline | null>(null)
  useScene('intro-sequence', stageRef, ({ gsap, reducedMotion }) => {
    // Kill any still-running one-shot timeline from a previous setup() call FIRST, before either
    // early-return branch below -- otherwise a stale timeline from a prior "play the full sequence"
    // pass keeps firing its own .set/.to/.call steps on a later tick, overwriting whatever this call
    // is about to set (re-dashing lines after Skip, re-triggering the fault after leaving the intro,
    // or simply running twice at once on re-entry). Confirmed as a real risk, not assumed: useGSAP's
    // scope-revert only reliably handles ScrollTrigger (see useScene.ts's own history on that); a plain
    // timeline gets no weaker a guarantee here than this explicit kill provides.
    tlRef.current?.kill()
    tlRef.current = null

    const stage = stageRef.current
    if (!stage || !introRef.current) return
    const allBuses = Array.from(stage.querySelectorAll<SVGGElement>('[data-testid="bus"]'))
    const allLineGroups = Array.from(stage.querySelectorAll<SVGGElement>('[data-testid="line"]'))
    const lineCores = Array.from(stage.querySelectorAll<SVGLineElement>('[data-testid="line-core"]'))
    const loadChevrons = Array.from(stage.querySelectorAll('[data-testid="load-chevron"]'))
    // Candidate (not-yet-added) lines: a separate overlay, always rendered on the one persistent stage
    // regardless of active chapter (confirmed real, not a bug -- e2e/addLine.spec.ts deliberately checks
    // them against the stage before ever scrolling to chapter 6, since AddLine's own control is lab-only
    // but the candidates it toggles live on the shared stage). Caught via a real screenshot during this
    // beat's own visual QA pass: without hiding these too, beat 1's "blackout, single energized node"
    // showed every candidate line crossing the dark stage. Not part of the BFS topology (they aren't
    // real network.lines), so they're treated as part of the "establishing" overlay revealed alongside
    // the glow group at the end of beat 2, not threaded through the BFS reveal itself.
    const candidateLines = Array.from(stage.querySelectorAll('[data-testid="candidate-line"]'))
    const glowGroup = stage.querySelector('[data-testid="glow-group"]')
    const heroBus = stage.querySelector(`[data-testid="bus"][data-bus="${HERO_BUS}"]`)
    const everything = [...allBuses, ...allLineGroups, ...loadChevrons, ...candidateLines, ...(glowGroup ? [glowGroup] : [])]

    // Convergence (same guarantee as beat 1's original fix, phase 9): once the user has genuinely left
    // the intro, force-clear every beat's work outright, deterministic regardless of tween progress.
    // Checked BEFORE the hero-bus lookup below so chrome visibility never depends on finding bus 0.
    if (active !== 'intro') {
      gsap.set(everything, { clearProps: 'opacity,filter' })
      lineCores.length && gsap.set(lineCores, { clearProps: DRAW_PROPS })
      setIntroFaultActive(false) // chapters other than 'intro' control their own story/live display (chapterDivergence.ts)
      setIntroChromeVisible(true) // the FIG index/Reset button must be visible once anywhere past the intro
      return
    }
    if (!heroBus || !network) return

    // Reduced motion AND "skip intro" both resolve to the SAME instant end state (DESIGN_SYSTEM.json's
    // skipIntro token says so explicitly: "identical to reduced-motion state").
    if (reducedMotion || skipped) {
      gsap.set(everything, { opacity: 1, clearProps: 'filter' })
      lineCores.length && gsap.set(lineCores, { clearProps: DRAW_PROPS })
      setIntroFaultActive(true)
      setIntroChromeVisible(true)
      return
    }

    // The full 12s sequence, played once on entering the intro.
    const { lineOrder, busOrder } = bfsFromHero(network, HERO_BUS)
    const lineElByIdx = new Map(allLineGroups.map(el => [Number(el.getAttribute('data-line')), el]))
    const coreByIdx = new Map(lineCores.map(el => {
      const group = el.closest('[data-testid="line"]')
      return [group ? Number(group.getAttribute('data-line')) : -1, el]
    }))
    const busElByIdx = new Map(allBuses.map(el => [Number(el.getAttribute('data-bus')), el]))

    const tl = gsap.timeline()
    tlRef.current = tl

    // Beat 1 (0-3s): blackout, hero bus visible, halo grows. Chevrons hidden explicitly here (not just
    // via the ancestor bus group's opacity 0) so beat 2's per-bus reveal doesn't make them visibly pop
    // in early, ahead of beat 3's own fade-in.
    tl.set(allLineGroups, { opacity: 0 })
      .set(allBuses, { opacity: 0 })
      .set(loadChevrons, { opacity: 0 })
      .set(candidateLines, { opacity: 0 })
    if (glowGroup) tl.set(glowGroup, { opacity: 0 })
    tl.set(heroBus, { opacity: 1, filter: 'drop-shadow(0 0 0px #EF9C54)' })
      .to(heroBus, { filter: 'drop-shadow(0 0 6px #EF9C54)', duration: 1.5, ease: 'power2.out' }, 0.5)

    // Beat 2 (3-6s): lines assemble outward from the hero bus in BFS order. Each line's core stroke
    // draws in (DrawSVGPlugin, "engraved hairline" reveal); the bus at its far end fades in the moment
    // that line reaches it.
    const beat2Start = 3
    const beat2Span = 2.6 // leave 0.4s settle before beat 3
    const perLine = lineOrder.length ? beat2Span / lineOrder.length : 0
    lineOrder.forEach((lineIdx, i) => {
      const groupEl = lineElByIdx.get(lineIdx)
      const coreEl = coreByIdx.get(lineIdx)
      const t = beat2Start + i * perLine
      if (groupEl) tl.set(groupEl, { opacity: 1 }, t)
      if (coreEl) {
        tl.fromTo(coreEl, { drawSVG: '0%' }, { drawSVG: '100%', duration: Math.max(perLine * 0.8, 0.05), ease: 'none' }, t)
      }
    })
    busOrder.forEach((busIdx, i) => {
      if (busIdx === HERO_BUS) return // already visible from beat 1
      const el = busElByIdx.get(busIdx)
      if (!el) return
      // a bus becomes visible once ANY line reaching it has drawn in -- approximate with its position
      // in busOrder (buses are discovered in the same BFS pass, so order tracks closely enough for a
      // one-shot establishing animation, not a precision-timed sync).
      const t = beat2Start + Math.min(i, lineOrder.length - 1) * perLine
      tl.set(el, { opacity: 1 }, t)
    })
    if (glowGroup) tl.set(glowGroup, { opacity: 1 }, beat2Start + beat2Span)
    tl.set(candidateLines, { opacity: 1 }, beat2Start + beat2Span)

    // Beat 3 (6-9s): demand currents pulse -- a dash-offset loop along each energized line's core
    // stroke, direction set from the REAL baseline flow sign on that line (not a uniform direction for
    // every line regardless of topology), magnitude-independent (this is a one-shot establishing cue,
    // not a precision flow visualization -- the live stage's own networkEncoding.energizedLine owns
    // that). Near-zero-flow lines are left undashed; there's no meaningful direction to show. Load
    // chevrons (already rendered by NetworkView, set from the fixture -- not tweened as a number) fade
    // in together.
    const beat3Start = 6
    tl.to(loadChevrons, { opacity: 1, duration: 0.6, stagger: 0.03 }, beat3Start)
    lineCores.forEach(coreEl => {
      const group = coreEl.closest('[data-testid="line"]')
      const lineIdx = group ? Number(group.getAttribute('data-line')) : NaN
      const flow = flows?.[lineIdx] ?? 0
      if (!Number.isFinite(flow) || Math.abs(flow) < 1e-3) return
      const direction = flow > 0 ? -20 : 20
      tl.set(coreEl, { strokeDasharray: '6 4', strokeDashoffset: 0 }, beat3Start)
        .to(coreEl, { strokeDashoffset: direction, duration: 2.6, ease: 'none', repeat: 1 }, beat3Start)
        .set(coreEl, { clearProps: DRAW_PROPS }, beat3Start + 2.9)
    })

    // Beat 4 (9-12s): fault interrupts. The fixture swap (src/scenes/introFixtureState.ts; presentation
    // only, AppState/the live scenario never changes) re-renders different DOM nodes for the affected
    // line (energized <g> -> outaged <g>, and island-dead lines become bare <line>s) -- animating a
    // specific element across that swap would tween a node that's about to be replaced. Instead the
    // WHOLE stage crossfades: fade out (0.35s), swap while invisible, fade back in (0.35s) -- a real
    // 700ms transition with no dependency on which nodes exist on either side of it.
    const beat4Start = 9
    tl.to(stage, { opacity: 0, duration: 0.35, ease: 'power1.in' }, beat4Start)
      .call(() => setIntroFaultActive(true), undefined, beat4Start + 0.35)
      .to(stage, { opacity: 1, duration: 0.35, ease: 'power1.out' }, beat4Start + 0.35)
      .set(stage, { clearProps: 'opacity' }, beat4Start + 0.7)
    tl.call(() => setIntroChromeVisible(true), undefined, beat4Start + 0.7)

    // A freshly built, playing timeline does not paint its time-0 state until the next ticker frame
    // (gsap's own rAF-driven loop) -- without forcing this, beat 1's blackout would be invisible for one
    // frame after mount (every bus/line briefly showing its pre-animation default instead). This forces
    // the SAME instant-apply guarantee the old standalone `gsap.set()` calls gave for free, now that
    // beat 1 lives inside a timeline alongside beats 2-4.
    tl.render(0, true, true)
  }, [active, network, skipped, flows])
  useEffect(() => () => { tlRef.current?.kill() }, []) // IntroSequence itself unmounting (not a chapter transition, which setup() above already handles)
  return null
}
