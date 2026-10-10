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

export function Scene() {
  const { state, dispatch, setLineOutage, setAddedLine } = useApp()
  if (state.load === 'loading') return <p role="status">Loading baseline</p>
  if (state.load === 'error' || !state.network || !state.result) return <p role="alert">Could not load data: {state.error}</p>
  return (
    <main>
      <h1>CASCADIA</h1>
      <StatusRegion />
      <RestorationStatusRegion />
      <NetworkView network={state.network} result={state.result.result} removedBus={state.removedBus}
        selectedBus={state.selectedBus} onSelect={bus => dispatch({ type: 'select', bus })}
        selectedLine={state.selectedLine} onSelectLine={line => dispatch({ type: 'selectLine', line })}
        alteredLines={Object.keys(state.lineCapacity).map(Number)} disabledLines={state.disabledLines}
        onRestoreLine={line => void setLineOutage(line, false)}
        candidates={state.candidates} addedLines={state.addedLines}
        // pending-aware, not just confirmed state.addedLines: a second click while this exact add/remove
        // is still in flight must continue the SAME direction, not flip it (matches AddLine.tsx's own
        // `eff` computation) -- found by advisor review, confirmed reachable via rapid SVG double-click.
        onToggleCandidate={pos => { const eff = state.pending?.addedLines ?? state.addedLines; void setAddedLine(pos, !eff.includes(pos)) }} />
      <ResetButton />
      {/* data-testid wrapper exists only so existing single-mount unit tests (App.test.tsx,
          resetAndInterrupt.test.tsx, newControls.test.tsx) can scope their queries with RTL's within()
          now that LabStub below renders a second copy of every testid/role -- mirrors e2e's home(page)
          locator, which scopes by [data-placement="home"] directly on each control's own <section>
          (no wrapper needed there since Playwright locators can span multiple root elements; RTL's
          within() needs a single container, hence this div). Not a layout change: no styling applied. */}
      <div data-testid="home-controls">
        <RemoveNode placement="home" />
        <AlterCapacity placement="home" />
        <IncreaseLoad placement="home" />
        <ReduceGenerator placement="home" />
        <LineOutage placement="home" />
        <AddLine placement="home" />
        <CompareRestoration placement="home" />
      </div>
      <p className="provenance">{state.result.label}</p>
      <LabStub />
    </main>
  )
}

// Dual-placement gate proof (advisor review, before the real chapter shell exists): the locator
// migration's home()/controlHome() scoping and the LineOutage mount-focus fix were only ever verified
// against a SINGLE mount. This mounts a second, real placement of all 7 controls so the full e2e/vitest
// suite exercises genuine two-DOM-instance behavior -- not a throwaway: the real chapter 6 laboratory
// will replace this section's shell (layout, heading, styling) but reuses this exact mount list.
// AddLine has no HOME chapter per docs/ART_DIRECTION.md's chapter table (lab-only); mounted here anyway
// since placement="lab" is this stub's only placement for every control regardless.
function LabStub() {
  return (
    <section data-testid="lab-stub" aria-label="Scenario laboratory (shell placeholder, chapter 6)">
      <h2>Scenario laboratory</h2>
      <RemoveNode placement="lab" />
      <AlterCapacity placement="lab" />
      <IncreaseLoad placement="lab" />
      <ReduceGenerator placement="lab" />
      <LineOutage placement="lab" />
      <AddLine placement="lab" />
      <CompareRestoration placement="lab" />
    </section>
  )
}

export default function App() {
  return <AppProvider><Scene /></AppProvider>
}
