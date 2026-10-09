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
  // N2 fix (same bug class as AlterCapacity.tsx, reintroduced here): resync ONLY on generator selection
  // change or an actual reset (epoch bump), not on every pending/genPmax change from unrelated controls.
  useEffect(() => { setMw(gen === null || !network ? 0 : eff[gen] ?? network.gens[gen].pmax_mw) },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gen, epoch])
  if (!network) return null
  return (
    <section aria-labelledby="rg-h">
      <h2 id="rg-h">Reduce generator</h2>
      <label>Generator{' '}
        <select value={gen ?? ''} onChange={e => setGen(e.target.value === '' ? null : +e.target.value)}>
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
