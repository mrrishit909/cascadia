import { useScene } from './useScene'

const RAIL_PAD = 8

// ART_DIRECTION.md section 3 + per-chapter motion table, row 3: "Section enters, then scrub. Scroll
// progress drives the network-to-rails geometry morph only. Rails straighten out of the network; the
// rest collapses into the locator inset." The locator-inset SIZE itself is NOT scroll-driven -- it's
// the same instant CSS-slot mechanism every other chapter already uses when `active` changes
// (experience.css's `data-active-chapter="ch3"` rule, now `transform:scale` instead of `width`, per
// the review that found chapter 2's width-transition competing with its own scrub: the same
// conflict would hit here if the inset's own size were ALSO scroll-driven). What scroll progress
// drives here is each rail's own `<line>` geometry: it starts at that line's REAL, MEASURED screen
// position within the already-shrunk inset (not a cosmetic guess), and straightens into a fixed
// horizontal bar as progress goes 0->1.
export function Chapter3Scene({ sectionRef, stageRef, active, railIds }: {
  sectionRef: React.RefObject<HTMLElement | null>
  stageRef: React.RefObject<HTMLDivElement | null>
  active: string
  railIds: number[]
}) {
  useScene('ch3-scene', sectionRef, ({ gsap, ScrollTrigger, reducedMotion }) => {
    const section = sectionRef.current
    const stage = stageRef.current
    if (!section || !stage) return

    // Convergence: once the user leaves ch3, force every rail line back to its (invisible, since the
    // corridor strip itself is inert/hidden by CSS once inactive) default -- deterministic regardless
    // of scrub progress, the same guarantee IntroSequence/Chapter2Scene already established.
    if (active !== 'ch3') {
      gsap.set('[data-testid="rail-line"]', { attr: { x1: 0, y1: 0, x2: 0, y2: 0 } })
      return
    }

    const mainSvg = stage.querySelector('svg')
    const glowGroup = stage.querySelector('[data-testid="glow-group"]')
    if (!mainSvg) return

    // Brief glow fade during the instant inset-shrink transform (the CSS transition that fires the
    // moment `active` becomes 'ch3') -- this project's OWN stated performance ladder, step 1
    // ("fade the glow group out during transforms and restore it after settle"), applied here
    // proactively rather than discovered later during frame-pacing measurement: a scaled stage with
    // the glow filter live is exactly ART_DIRECTION.md's kill-criterion scenario.
    if (glowGroup && !reducedMotion) {
      gsap.fromTo(glowGroup, { opacity: 0 }, { opacity: 1, duration: 0.3, delay: 0.3 })
    }

    type RailTarget = { idx: number; svg: SVGSVGElement; core: SVGLineElement; line: SVGLineElement; tick: SVGLineElement | null; flow: number; rating: number }
    const measure = (): RailTarget[] => {
      const targets: RailTarget[] = []
      for (const svg of Array.from(section.querySelectorAll<SVGSVGElement>('[data-testid="rail-line-svg"]'))) {
        const idx = Number(svg.getAttribute('data-rail-line'))
        const core = stage.querySelector<SVGLineElement>(`[data-testid="line"][data-line="${idx}"] [data-testid="line-core"]`)
          ?? stage.querySelector<SVGLineElement>(`line[data-testid="line"][data-line="${idx}"]`) // de-energized lines render as a bare <line>, no nested core
        const line = svg.querySelector<SVGLineElement>('[data-testid="rail-line"]')
        const tick = svg.querySelector<SVGLineElement>('[data-testid="rail-tick"]')
        if (!core || !line) continue
        const flow = Math.abs(Number(svg.closest('li')?.querySelector('[data-testid="rail-flow"]')?.getAttribute('data-flow-mw') ?? 0))
        const rating = Number(svg.closest('li')?.querySelector('[data-testid="rail-flow"]')?.getAttribute('data-rating-mw') ?? 1)
        targets.push({ idx, svg, core, line, tick, flow, rating })
      }
      return targets
    }

    const apply = (p: number) => {
      // jsdom (vitest) doesn't implement SVG geometry APIs at all (no getScreenCTM, no real layout) --
      // real-browser e2e is this scene's actual coverage for the geometry morph itself; vitest only
      // needs to confirm the scene mounts/unmounts safely alongside the rest of the app.
      if (typeof mainSvg.getScreenCTM !== 'function') return
      const ctm = mainSvg.getScreenCTM()
      if (!ctm) return
      for (const t of measure()) {
        const rect = t.svg.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) continue
        t.svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`)
        const sx1 = t.core.x1?.baseVal?.value ?? 0, sy1 = t.core.y1?.baseVal?.value ?? 0
        const sx2 = t.core.x2?.baseVal?.value ?? 0, sy2 = t.core.y2?.baseVal?.value ?? 0
        const p1 = new DOMPoint(sx1, sy1).matrixTransform(ctm)
        const p2 = new DOMPoint(sx2, sy2).matrixTransform(ctm)
        const startX1 = p1.x - rect.left, startY1 = p1.y - rect.top
        const startX2 = p2.x - rect.left, startY2 = p2.y - rect.top
        const barFrac = Math.min(1, t.rating > 0 ? t.flow / t.rating : 0)
        const endY = rect.height / 2
        const endX1 = RAIL_PAD
        const endX2 = RAIL_PAD + (rect.width - 2 * RAIL_PAD) * barFrac
        const lerp = (a: number, b: number) => a + (b - a) * p
        gsap.set(t.line, { attr: { x1: lerp(startX1, endX1), y1: lerp(startY1, endY), x2: lerp(startX2, endX2), y2: lerp(startY2, endY) } })
        if (t.tick) {
          const tickX = RAIL_PAD + (rect.width - 2 * RAIL_PAD)
          gsap.set(t.tick, { attr: { x1: lerp(startX2, tickX), x2: lerp(startX2, tickX) }, opacity: p })
        }
      }
    }

    if (reducedMotion) { apply(1); return }

    const st = ScrollTrigger.create({
      id: 'ch3-scene-scrub',
      trigger: section,
      start: 'top top',
      end: '40% top', // ch3's own handoff to ch4 happens 0.5-0.6 through the section (swept empirically, same method chapter 2's review used) -- lower than chapter 2's own 60% since ch3's default section height differs
      scrub: true,
      onUpdate: self => apply(self.progress),
      // ScrollTrigger already debounces window resize/orientation-change internally and recalculates
      // start/end then fires this -- preferred over a manually managed `window.addEventListener`
      // listener, since useScene's `setup()` has no cleanup-return mechanism to unregister one with
      // (only ScrollTriggers/tweens tagged for this sceneId are torn down automatically).
      onRefresh: self => apply(self.progress),
    })
    apply(st.progress)
  }, [active, railIds.join(',')])
  return null
}
