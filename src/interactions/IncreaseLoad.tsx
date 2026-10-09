import { useEffect, useState } from 'react'
import { useApp } from '../app/state'
import { ScenarioReadout } from './ScenarioReadout'

// CAS-INT-002. Pick a load bus, set a multiplier, Apply -> Worker solve (load_scale). Re-selecting the same
// factor 1 restores that bus.
export function IncreaseLoad() {
  const { state, setLoadScale } = useApp()
  const { network, loadScale, pending, solve, epoch } = state
  const eff = pending?.loadScale ?? loadScale
  const [bus, setBus] = useState<number | null>(null)
  const [f, setF] = useState(1)
  // D1/N2-class fix (same race as ReduceGenerator.tsx, see its comment): resyncing `f` from an effect
  // keyed on `bus` left a gap where an immediate slider move after selection could be silently reverted
  // once the effect flushed. Set bus and f synchronously in the same onChange handler instead. An actual
  // reset (epoch bump) still needs its own effect.
  useEffect(() => { if (bus !== null) setF(eff[bus] ?? 1) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [epoch])
  if (!network) return null
  const base = bus === null ? 0 : network.loads.find(l => l.bus === bus)?.p_mw ?? 0
  const selectBus = (next: number | null) => {
    setBus(next)
    setF(next === null ? 1 : eff[next] ?? 1)
  }
  return (
    <section aria-labelledby="il-h">
      <h2 id="il-h">Increase load</h2>
      <label>Load bus{' '}
        <select value={bus ?? ''} onChange={e => selectBus(e.target.value === '' ? null : +e.target.value)}>
          <option value="">Select a bus</option>
          {network.loads.map(l => <option key={l.bus} value={l.bus}>{network.buses[l.bus].name} ({l.p_mw} MW)</option>)}
        </select>
      </label>
      {bus !== null && (
        <div role="group" aria-label="Load scale">
          <label>Load multiplier{' '}
            <input type="range" min={1} max={10} step={0.25} value={f} onChange={e => setF(+e.target.value)}
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
