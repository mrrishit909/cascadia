import { useId } from 'react'
import { useApp } from '../app/state'
import { ScenarioReadout } from './ScenarioReadout'

// CAS-INT-002. Pick a load bus, set a multiplier, Apply -> Worker solve (load_scale). Re-selecting the same
// factor 1 restores that bus.
//
// Architecture-stabilization pass: {bus, f} now lives in shared AppState.loadDraft (not local
// useState), set via ONE dispatch in selectBus -- not a select onChange plus a separate resync
// effect -- which is also what fixed the original select-then-slider race at its root (no gap
// between "selection changed" and "draft caught up" for an interleaved event to land in). Reset
// clears loadDraft directly in the reducer, so no epoch-watching effect is needed here at all.
export function IncreaseLoad({ placement = 'home' }: { placement?: 'home' | 'lab' } = {}) {
  const { state, dispatch, setLoadScale } = useApp()
  const { network, loadScale, pending, solve, loadDraft } = state
  const eff = pending?.loadScale ?? loadScale
  const { bus, f } = loadDraft
  const headingId = useId()
  if (!network) return null
  const base = bus === null ? 0 : network.loads.find(l => l.bus === bus)?.p_mw ?? 0
  const selectBus = (next: number | null) => dispatch({ type: 'setLoadDraft', bus: next, f: next === null ? 1 : eff[next] ?? 1 })
  return (
    <section data-placement={placement} aria-labelledby={headingId}>
      <h2 id={headingId}>Increase load</h2>
      <label>Load bus{' '}
        <select value={bus ?? ''} onChange={e => selectBus(e.target.value === '' ? null : +e.target.value)}>
          <option value="">Select a bus</option>
          {network.loads.map(l => <option key={l.bus} value={l.bus}>{network.buses[l.bus].name} ({l.p_mw} MW)</option>)}
        </select>
      </label>
      {bus !== null && (
        <div role="group" aria-label="Load scale">
          <label>Load multiplier{' '}
            <input type="range" min={1} max={10} step={0.25} value={f} onChange={e => dispatch({ type: 'setLoadDraft', bus, f: +e.target.value })}
              aria-valuetext={`${f.toFixed(2)}x, ${(base * f).toFixed(1)} MW`} />
          </label>
          <output data-testid="load-factor">{f.toFixed(2)}x</output>{' '}
          <span data-testid="load-mw">{(base * f).toFixed(1)} MW demand</span>{' '}
          <button disabled={solve === 'solving'} onClick={() => setLoadScale(bus, f)}>Apply load</button>
        </div>
      )}
      <ScenarioReadout id="load" />
    </section>
  )
}
