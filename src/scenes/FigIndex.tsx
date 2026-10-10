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

export function FigIndex({ active }: { active: string }) {
  // ART_DIRECTION.md opening storyboard beat 4 (9-12s): "The FIG index, SKIP/ENTER controls and the
  // status region fade in." Stays mounted throughout (never conditionally rendered), just inert and
  // invisible via CSS until the intro sequence (or reduced motion, or skipping the intro) makes it
  // visible -- `inert` removes it from the tab order and AT tree while hidden, rather than leaving a
  // confusing invisible-but-focusable "phantom" set of links.
  const visible = useIntroChromeVisible()
  return (
    <nav className="fig-index" aria-label="Chapter index" data-chrome-visible={visible} inert={!visible}>
      {ITEMS.map(item => (
        <a key={item.id} href={`#${item.id}`} aria-current={active === item.id ? 'step' : undefined}>
          {item.fig}
        </a>
      ))}
    </nav>
  )
}
