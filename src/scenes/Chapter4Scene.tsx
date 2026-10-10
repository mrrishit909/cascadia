import { useRef } from 'react'
import { useScene, type SceneTools } from './useScene'

const DURATION = 0.7 // ART_DIRECTION.md section 3's single-shot rule: "every affected element changes in the same 700ms tween"
const SEPARATION_PX = 24

function parseTranslate(el: SVGGElement): { x: number; y: number } {
  const m = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(el.getAttribute('transform') ?? '')
  return m ? { x: Number(m[1]), y: Number(m[2]) } : { x: 0, y: 0 }
}

// ART_DIRECTION.md section 3's "single-shot rule" (load-bearing): "The engine is one island-aware
// DC-OPF solve, not a cascading-trip model. Chapter 4 therefore shows exactly ONE state transition:
// baseline, then the post-fault solution... every affected element changes in the same 700ms tween.
// There is no stagger by graph distance, no darkness spreading node to node and no sequential trips,
// because any of those would visually claim a cascade model we do not have." The analytical swap
// itself (App.tsx's story/live switch, chapter4Diverged) is already instant and correct -- this scene
// wraps that instant React state change in ONE motion: a whole-stage crossfade (same proven technique
// IntroSequence's own beat 4 established for an identical problem -- a React prop swap can't be
// intercepted mid-render to animate a literal "before" state, so the WHOLE stage briefly dims while
// the swap happens invisibly, then returns) plus a real, data-driven "islands separate" flourish
// WITHIN that same window: buses in a no-generation island (data-state="shed_no_generation", the
// actual analytical marker NetworkView already renders, not a guess) nudge outward from the network's
// own centroid and settle, reading as genuine separation rather than a literal baseline-position ->
// separated-position interpolation (which isn't achievable without duplicating React's render output
// as a frozen "before" snapshot -- a real simplification, documented, not a silently cut corner).
// Re-fires on every CHANGE the ledger shows, not just entry: `resultKey` (App.tsx) changes whenever
// the displayed removed-element/disabled-lines set changes, whether from scrolling in fresh or from a
// later RemoveNode/LineOutage confirmation while already on chapter 4.
//
// REGRESSION (found via an UNRELATED e2e test, touch.spec.ts, suddenly failing to find buses at their
// real screen position -- not by this chapter's own tests, which is itself a lesson): GSAP's x/y
// properties are ABSOLUTE. `gsap.set(bus, {x:0,y:0})`, tried first as a blanket "clear any previous
// nudge" on EVERY bus every run, instead overwrote each bus's REAL `transform="translate(x y)"`
// position with an identity transform -- collapsing every bus in the network to the SVG's origin
// corner, not just the ones ever nudged. `clearProps` was tried next and ALSO insufficient: GSAP's SVG
// transform support can write directly to the `transform` ATTRIBUTE (not a CSS style) for an element
// like this, and `clearProps` only reverses an inline CSS style -- it does nothing for an
// attribute-level write, and because React's reconciliation compares its own virtual-DOM output
// (unchanged, since bus layout is static) rather than the actual DOM, a React re-render does NOT
// restore the attribute either once GSAP has overwritten it outside React's knowledge. The only
// reliable fix: capture each bus's TRUE natural position ONCE, the first time (and only time) this
// scene ever touches it, in a ref that survives across re-runs -- never re-derive "natural" from the
// DOM on a later run, since by then it may already be corrupted.
export function Chapter4Scene({ stageRef, sectionRef, active, resultKey }: {
  stageRef: React.RefObject<HTMLDivElement | null>
  sectionRef: React.RefObject<HTMLElement | null>
  active: string
  resultKey: string
}) {
  const naturalPos = useRef(new Map<string, { x: number; y: number }>())
  const prevNudged = useRef(new Set<string>())

  useScene('ch4-scene', stageRef, ({ gsap, reducedMotion }) => {
    const stage = stageRef.current
    const section = sectionRef.current
    if (!stage || !section) return
    const ledger = section.querySelector('[aria-label="Fault ledger"]')
    const allBuses = Array.from(stage.querySelectorAll<SVGGElement>('[data-testid="bus"]'))
    const busById = new Map(allBuses.map(el => [el.getAttribute('data-bus') ?? '', el]))
    const isolatedBuses = allBuses.filter(el => el.getAttribute('data-state') === 'shed_no_generation')
    const isolatedIds = new Set(isolatedBuses.map(el => el.getAttribute('data-bus') ?? ''))

    gsap.killTweensOf([stage, ledger, ...allBuses])

    // Release any bus that was nudged in a PREVIOUS run but is no longer isolated now -- using the
    // NATURAL position captured the first time THIS scene ever touched it, never a fresh DOM read.
    for (const id of prevNudged.current) {
      if (isolatedIds.has(id)) continue
      const el = busById.get(id)
      const nat = naturalPos.current.get(id)
      if (el && nat) gsap.set(el, { x: nat.x, y: nat.y })
      prevNudged.current.delete(id)
    }

    if (active !== 'ch4' || reducedMotion) {
      gsap.set(stage, { opacity: 1 })
      if (ledger) gsap.set(ledger, { opacity: 1 })
      // Reduced motion / leaving the chapter: snap any currently-isolated buses straight to their
      // separated end position (no stagger, matches the rest of this scene's reduced-motion behavior)
      // using the same natural-position bookkeeping, not a fresh DOM read.
      if (isolatedBuses.length) applyOffsets(isolatedBuses, allBuses, naturalPos.current, prevNudged.current, gsap, 0)
      return
    }

    const tl = gsap.timeline()
    tl.to(stage, { opacity: 0.15, duration: DURATION / 2, ease: 'power1.in' })
      .set(ledger ? [ledger] : [], { opacity: 0 }, 0)
      .to(stage, { opacity: 1, duration: DURATION / 2, ease: 'power1.out' }, DURATION / 2)
      .set(ledger ? [ledger] : [], { opacity: 1 }, DURATION) // ledger numbers appear exactly at tween completion, never mid-tween

    applyOffsets(isolatedBuses, allBuses, naturalPos.current, prevNudged.current, gsap, DURATION / 2, tl)
  }, [active, resultKey])
  return null
}

// Shared by the animated (tl present) and reduced-motion/instant (tl absent -> gsap.set) paths.
function applyOffsets(
  isolatedBuses: SVGGElement[],
  allBuses: SVGGElement[],
  naturalPos: Map<string, { x: number; y: number }>,
  prevNudged: Set<string>,
  gsap: SceneTools['gsap'],
  startAt: number,
  tl?: ReturnType<SceneTools['gsap']['timeline']>,
) {
  if (!isolatedBuses.length) return
  const naturalOf = (el: SVGGElement) => {
    const id = el.getAttribute('data-bus') ?? ''
    let p = naturalPos.get(id)
    if (!p) { p = parseTranslate(el); naturalPos.set(id, p) } // capture ONCE, first time this bus is ever touched
    return p
  }
  const cx = allBuses.reduce((s, el) => s + naturalOf(el).x, 0) / (allBuses.length || 1)
  const cy = allBuses.reduce((s, el) => s + naturalOf(el).y, 0) / (allBuses.length || 1)
  for (const el of isolatedBuses) {
    const id = el.getAttribute('data-bus') ?? ''
    const { x, y } = naturalOf(el)
    const dx = x - cx, dy = y - cy
    const len = Math.hypot(dx, dy) || 1
    const ox = x + (dx / len) * SEPARATION_PX, oy = y + (dy / len) * SEPARATION_PX
    prevNudged.add(id)
    if (tl) tl.to(el, { x: ox, y: oy, duration: DURATION / 2, ease: 'power2.out' }, startAt)
    else gsap.set(el, { x: ox, y: oy })
  }
}
