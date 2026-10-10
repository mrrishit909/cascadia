// docs/ART_DIRECTION.md section 1 ("Navigation"): chapters are a numbered plate index, FIG. 01 to
// FIG. 06, real anchor links (tabbable, aria-current="step"), reaching every chapter without scrolling
// through intermediate ones. DESIGN_SYSTEM.json componentStates.chapterIndexItem for the visual states.
import { useIntroChromeVisible } from './introChromeState'

const ITEMS: { id: string; fig: string; name: string }[] = [
  { id: 'intro', fig: 'INTRO', name: 'Grid formation' },
  { id: 'ch1', fig: 'FIG. 01', name: 'Grid formation' },
  { id: 'ch2', fig: 'FIG. 02', name: 'Demand and generation' },
  { id: 'ch3', fig: 'FIG. 03', name: 'Capacity bottlenecks' },
  { id: 'ch4', fig: 'FIG. 04', name: 'Outage cascades' },
  { id: 'ch5', fig: 'FIG. 05', name: 'Recovery plans' },
  { id: 'ch6', fig: 'FIG. 06', name: 'Scenario laboratory' },
]

// ART_DIRECTION.md's motion sheet: scroll-bound chapters' own row says "Direct index navigation
// lands in the end state" (chapter 2) / "jump snaps to rails" (chapter 3) -- a plain `href="#ch2"`
// anchor jump lands at the SECTION'S TOP (scrub progress 0), not its end state. Fraction here must
// match that chapter's own scene's ScrollTrigger `end` (Chapter2Scene.tsx's '60% top', Chapter3Scene.tsx's
// '40% top'), so a direct jump and a full scroll-through land in the identical place.
const SCRUB_END_FRACTION: Record<string, number> = { ch2: 0.6, ch3: 0.4 }

export function FigIndex({ active }: { active: string }) {
  // ART_DIRECTION.md opening storyboard beat 4 (9-12s): "The FIG index, SKIP/ENTER controls and the
  // status region fade in." Stays mounted throughout (never conditionally rendered), just inert and
  // invisible via CSS until the intro sequence (or reduced motion, or skipping the intro) makes it
  // visible -- `inert` removes it from the tab order and AT tree while hidden, rather than leaving a
  // confusing invisible-but-focusable "phantom" set of links.
  const visible = useIntroChromeVisible()
  const jumpToScrubEnd = (id: string, e: React.MouseEvent<HTMLAnchorElement>) => {
    const frac = SCRUB_END_FRACTION[id]
    if (frac == null) return // every other chapter: plain anchor jump to the section top is correct
    e.preventDefault()
    const el = document.getElementById(id)
    if (!el) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: el.offsetTop + el.offsetHeight * frac, behavior: reducedMotion ? 'auto' : 'smooth' })
  }
  return (
    <nav className="fig-index" aria-label="Chapter index" data-chrome-visible={visible} inert={!visible}>
      {ITEMS.map(item => (
        <a key={item.id} href={`#${item.id}`} aria-current={active === item.id ? 'step' : undefined}
          onClick={e => jumpToScrubEnd(item.id, e)}>
          {item.fig}
        </a>
      ))}
    </nav>
  )
}
