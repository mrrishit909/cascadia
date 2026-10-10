import { AppProvider, useApp } from './state'
import { RemoveNode } from '../interactions/RemoveNode'
import { AlterCapacity } from '../interactions/AlterCapacity'
import { IncreaseLoad } from '../interactions/IncreaseLoad'
import { ReduceGenerator } from '../interactions/ReduceGenerator'
import { LineOutage } from '../interactions/LineOutage'
import { AddLine } from '../interactions/AddLine'
import { CompareRestoration } from '../interactions/CompareRestoration'
import { StatusRegion } from '../interactions/StatusRegion'
import { RestorationStatusRegion } from '../interactions/RestorationStatusRegion'
import { ResetButton } from './ResetButton'
import { NetworkView } from '../visualization/NetworkView'
import { useActiveChapter } from '../scenes/useActiveChapter'
import { FigIndex } from '../scenes/FigIndex'
import { Chapter4Ledger } from '../scenes/Chapter4Ledger'
import { useFixture } from '../scenes/useFixture'
import { chapter2Diverged, chapter3Diverged, chapter4Diverged } from './chapterDivergence'
import type { Precomputed, SolveResult } from '../engine/types'
import '../scenes/experience.css'

const CHAPTER_IDS = ['intro', 'ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6']

export function Scene() {
  const { state, dispatch, setLineOutage, setAddedLine } = useApp()
  const active = useActiveChapter(CHAPTER_IDS)
  // Story/lab boundary (CHAPTER_ARCHITECTURE.md section 1): ch4's own precomputed fixture, fetched
  // directly, never through the live solver. Chapters 2/3's story is the baseline fixture itself
  // (state.baseline, already loaded) -- confirmed against the plan: both controls' divergence is
  // measured against baseline's own Scen defaults, so baseline IS their un-diverged story.
  const ch4Fixture = useFixture<Precomputed>('precomputed/ch4_fault_bus26.json')

  if (state.load === 'loading') return <p role="status">Loading baseline</p>
  if (state.load === 'error' || !state.network || !state.result || !state.baseline) return <p role="alert">Could not load data: {state.error}</p>

  // The ONE persistent stage's props for the currently active chapter: story fixture until that
  // chapter's own hosted control(s) diverge from baseline (chapterDivergence.ts), then the live result
  // -- never by result-object identity, see chapterDivergence.ts's own comment for why. Chapter 5 hides
  // the stage entirely via CSS (CHAPTER_ARCHITECTURE.md section 2: the only chapter where the stage is
  // inert, three independent mini networks do the work instead) so its branch here is unreachable in
  // practice but still falls through safely to baseline. Chapter 6 (lab) is always live -- it has no
  // story, that's the point of a laboratory.
  const diverged2 = chapter2Diverged({ loadScale: state.loadScale, genPmax: state.genPmax })
  const diverged3 = chapter3Diverged({ lineCapacity: state.lineCapacity, allowShed: state.allowShed })
  const diverged4 = chapter4Diverged({ removedBus: state.removedBus, disabledLines: state.disabledLines })
  let stageResult: SolveResult = state.baseline.result
  let stageRemovedBus: number | null = null
  let stageDisabledLines: number[] = []
  let stageAlteredLines: number[] = []
  if (active === 'ch2') {
    stageResult = diverged2 ? state.result.result : state.baseline.result
  } else if (active === 'ch3') {
    stageResult = diverged3 ? state.result.result : state.baseline.result
    stageAlteredLines = diverged3 ? Object.keys(state.lineCapacity).map(Number) : []
  } else if (active === 'ch4') {
    stageResult = diverged4 ? state.result.result : (ch4Fixture?.result ?? state.baseline.result)
    stageRemovedBus = diverged4 ? state.removedBus : 26
    stageDisabledLines = diverged4 ? state.disabledLines : []
  } else if (active === 'ch6') {
    stageResult = state.result.result
    stageRemovedBus = state.removedBus
    stageDisabledLines = state.disabledLines
    stageAlteredLines = Object.keys(state.lineCapacity).map(Number)
  }
  // intro/ch1/ch5: baseline, no live override -- chapter 1 has no controls at all, chapter 5's stage is
  // hidden via CSS regardless of what props it receives.

  return (
    <main className="experience">
      <FigIndex active={active} />
      <StatusRegion />
      <RestorationStatusRegion />
      <ResetButton />

      {/* The one persistent SVG stage (docs/ART_DIRECTION.md global motion rule 3): mounts once, stays
          mounted, changes only via props/camera -- never remounts across chapters. Its on-screen SLOT
          (size/position) is driven by CSS keyed on data-active-chapter (src/scenes/experience.css);
          its CONTENT (which result/removedBus/etc. it shows) is driven by the story/lab switch above. */}
      <div className="stage-sticky" data-active-chapter={active}>
        <div className="stage-inner">
          <NetworkView network={state.network} result={stageResult} removedBus={stageRemovedBus}
            selectedBus={state.selectedBus} onSelect={bus => dispatch({ type: 'select', bus })}
            selectedLine={state.selectedLine} onSelectLine={line => dispatch({ type: 'selectLine', line })}
            alteredLines={stageAlteredLines} disabledLines={stageDisabledLines}
            onRestoreLine={line => void setLineOutage(line, false)}
            candidates={state.candidates} addedLines={state.addedLines}
            // pending-aware, not just confirmed state.addedLines: a second click while this exact
            // add/remove is still in flight must continue the SAME direction, not flip it (matches
            // AddLine.tsx's own `eff` computation) -- found by advisor review, confirmed reachable via
            // rapid SVG double-click.
            onToggleCandidate={pos => { const eff = state.pending?.addedLines ?? state.addedLines; void setAddedLine(pos, !eff.includes(pos)) }} />
        </div>
      </div>

      <section id="intro" className="chapter-section" data-archetype="immersive">
        <h1>CASCADIA</h1>
        <p className="chapter-prose">An electrical grid, reconstructed under computed flow constraints.</p>
      </section>

      <section id="ch1" className="chapter-section" data-archetype="immersive">
        <h2>FIG. 01 &mdash; Grid formation</h2>
        <p className="chapter-prose">The IEEE case30 network at baseline dispatch.</p>
      </section>

      <section id="ch2" className="chapter-section">
        <div className="chapter-prose">
          <h2>FIG. 02 &mdash; Demand and generation</h2>
          <p>Raise load at a bus or reduce a generator&apos;s output limit to see dispatch respond.</p>
        </div>
        <div className="chapter-controls-column">
          <IncreaseLoad placement="home" />
          <ReduceGenerator placement="home" />
        </div>
      </section>

      <section id="ch3" className="chapter-section">
        <div className="chapter-prose">
          <h2>FIG. 03 &mdash; Capacity bottlenecks</h2>
          <p>Alter a line&apos;s thermal capacity and watch its binding status update.</p>
        </div>
        <div className="chapter-controls-column">
          <AlterCapacity placement="home" />
        </div>
      </section>

      <section id="ch4" className="chapter-section">
        <div className="chapter-prose">
          <h2>FIG. 04 &mdash; Outage cascades</h2>
          <p>Remove a substation or disable a line to see islands separate and load shed.</p>
        </div>
        <Chapter4Ledger />
        <div className="chapter-controls-column">
          <RemoveNode placement="home" />
          <LineOutage placement="home" />
        </div>
      </section>

      <section id="ch5" className="chapter-section">
        <div className="chapter-prose">
          <h2>FIG. 05 &mdash; Recovery plans</h2>
          <p>Compare restoration sequences by served energy.</p>
        </div>
        <div className="chapter-controls-column">
          <CompareRestoration placement="home" />
        </div>
      </section>

      <section id="ch6" className="chapter-section" aria-label="Scenario laboratory">
        <h2>FIG. 06 &mdash; Scenario laboratory</h2>
        <div className="chapter-controls-column">
          <RemoveNode placement="lab" />
          <AlterCapacity placement="lab" />
          <IncreaseLoad placement="lab" />
          <ReduceGenerator placement="lab" />
          <LineOutage placement="lab" />
          <AddLine placement="lab" />
          <CompareRestoration placement="lab" />
        </div>
      </section>

      <p className="provenance">{state.result.label}</p>
    </main>
  )
}

export default function App() {
  return <AppProvider><Scene /></AppProvider>
}
