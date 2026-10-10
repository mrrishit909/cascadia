import { useApp } from '../app/state'
import { chapter4Diverged } from '../app/chapterDivergence'
import { useFixture } from './useFixture'
import type { Precomputed } from '../engine/types'
import type { DcopfResult } from '../engine/dcopf'

// docs/ART_DIRECTION.md chapter 4 row: "A fault ledger sits right in cols 9-12: removed element, island
// count, isolated MW, economically shed MW, objective change. The disclaimer sits directly under the
// numbers." Section 3's single-shot rule requires the disclaimer text verbatim.
//
// Story/lab switch (CHAPTER_ARCHITECTURE.md section 3, independent-review item "resolve the readouts
// before calling chapter 4 done"): shows the chapter's own STORY fixture (ch4_fault_bus26, bus 26
// removed) until the user's OWN action in this chapter's hosted controls (RemoveNode/LineOutage)
// diverges from baseline -- chapter4Diverged(), comparing only removedBus/disabledLines against their
// literal defaults, never by result-object identity. Once diverged, the ledger switches to the LIVE
// result and is labeled YOUR SCENARIO instead of STORY, so it never disagrees with what RemoveNode's own
// readout shows below it.
export function Chapter4Ledger() {
  const { state } = useApp()
  const fixture = useFixture<Precomputed>('precomputed/ch4_fault_bus26.json')
  const diverged = chapter4Diverged({ removedBus: state.removedBus, disabledLines: state.disabledLines })
  const active = diverged ? state.result : fixture
  const baseline = state.baseline
  if (!active || !baseline || !state.network) return <p className="chapter-prose">Loading fixture...</p>
  const r = active.result as DcopfResult
  const islandCount = r.islands.length
  const isolatedMw = r.islands.filter(i => i.kind === 'shed_no_generation').reduce((s, i) => s + (i.shed_mw ?? 0), 0)
  // ch4_fault_bus26.json's own meta.params.removed_buses is [26] -- derive the display name from the
  // live network object (topology is identical story/live, only the scenario applied to it differs),
  // never a hardcoded bus name.
  const removedLabel = diverged
    ? state.removedBus !== null ? `Bus ${state.network.buses[state.removedBus].name}` : state.disabledLines.length ? `Line${state.disabledLines.length > 1 ? 's' : ''} ${state.disabledLines.join(', ')}` : 'none'
    : `Bus ${state.network.buses[26].name}`
  const objectiveChange = r.objective - baseline.result.objective
  return (
    <div className="chapter-controls-column" aria-label="Fault ledger">
      <p data-testid="ch4-mode" style={{ color: diverged ? 'var(--copper)' : 'var(--text-muted)' }}>
        {diverged ? 'YOUR SCENARIO' : 'STORY'}
      </p>
      <dl>
        <dt>Removed element</dt><dd data-testid="ch4-removed">{removedLabel}</dd>
        <dt>Islands</dt><dd data-testid="ch4-islands">{islandCount}</dd>
        <dt>Isolated (no generation)</dt><dd data-testid="ch4-isolated">{isolatedMw.toFixed(2)} MW</dd>
        <dt>Shed, economic</dt><dd data-testid="ch4-shed-economic">{(r.shed_economic_mw ?? 0).toFixed(2)} MW</dd>
        <dt>Objective change</dt><dd data-testid="ch4-objective-change">{objectiveChange >= 0 ? '+' : ''}{objectiveChange.toFixed(2)}</dd>
      </dl>
      <p className="chapter-prose" data-testid="ch4-disclaimer">
        Single LP solve after the fault. Cascading trips are not modeled.
      </p>
    </div>
  )
}
