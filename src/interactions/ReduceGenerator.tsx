import { useEffect, useState } from 'react'
import { useApp } from '../app/state'
import { ScenarioReadout } from './ScenarioReadout'

// CAS-INT-003. Pick a generator, lower its Pmax (0..rated), Apply -> Worker solve (gen_pmax_mw).
export function ReduceGenerator() {
  const { state, setGenPmax } = useApp()
  const { network, genPmax, pending, solve, epoch } = state
  const eff = pending?.genPmax ?? genPmax
  const [gen, setGen] = useState<number | null>(null)
  const [mw, setMw] = useState(0)
  const rated = gen === null || !network ? 0 : network.gens[gen].pmax_mw
  // D1/N2-class fix: resyncing `mw` from a `useEffect` keyed on `gen` left a window where a user (or a
  // fast scripted interaction) could move the slider in the gap between the select's onChange committing
  // `gen` and the effect's own flush, which then unconditionally overwrote that slider move back to
  // `rated` -- silently reverting real user intent (confirmed by reproducing it directly: looping
  // select+immediate-slider-set+Apply without a settle delay lost entire generator reductions, sometimes
  // re-submitting `mw === rated` as "restore to rated" instead of the user's actual value). Fixed by
  // setting gen and mw SYNCHRONOUSLY in the same onChange handler -- no effect, no gap. An actual reset
  // (epoch bump) still needs a separate effect since nothing else fires exactly then.
  useEffect(() => { if (gen !== null && network) setMw(eff[gen] ?? network.gens[gen].pmax_mw) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [epoch])
  if (!network) return null
  const selectGen = (next: number | null) => {
    setGen(next)
    setMw(next === null ? 0 : eff[next] ?? network.gens[next].pmax_mw)
  }
  return (
    <section aria-labelledby="rg-h">
      <h2 id="rg-h">Reduce generator</h2>
      <label>Generator{' '}
        <select value={gen ?? ''} onChange={e => selectGen(e.target.value === '' ? null : +e.target.value)}>
          <option value="">Select a generator</option>
          {network.gens.map(g => <option key={g.idx} value={g.idx}>Gen {g.idx} at {network.buses[g.bus].name} (rated {g.pmax_mw} MW)</option>)}
        </select>
      </label>
      {gen !== null && (
        <div role="group" aria-label="Generator limit">
          <label>Pmax{' '}
            <input type="range" min={0} max={rated} step={1} value={mw} onChange={e => setMw(+e.target.value)}
              aria-valuetext={`${mw} of ${rated} MW`} />
          </label>
          <output data-testid="gen-pmax">{mw} MW</output>{' '}
          <button disabled={solve === 'solving'} onClick={() => setGenPmax(gen, mw === rated ? null : mw)}>Apply limit</button>
        </div>
      )}
      <ScenarioReadout id="gen" />
    </section>
  )
}
