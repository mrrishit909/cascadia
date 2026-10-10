// docs/ART_DIRECTION.md section 1 ("Navigation"): chapters are a numbered plate index, FIG. 01 to
// FIG. 06, real anchor links (tabbable, aria-current="step"), reaching every chapter without scrolling
// through intermediate ones. DESIGN_SYSTEM.json componentStates.chapterIndexItem for the visual states.
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
  return (
    <nav className="fig-index" aria-label="Chapter index">
      {ITEMS.map(item => (
        <a key={item.id} href={`#${item.id}`} aria-current={active === item.id ? 'step' : undefined}>
          {item.fig}
        </a>
      ))}
    </nav>
  )
}
