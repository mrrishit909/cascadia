import { useId } from 'react'
import { useApp } from '../app/state'
import { ScenarioReadout } from './ScenarioReadout'

// CAS-INT-003. Pick a generator, lower its Pmax (0..rated), Apply -> Worker solve (gen_pmax_mw).
//
// Architecture-stabilization pass: {gen, mw} now lives in shared AppState.genDraft (not local
// useState), set via ONE dispatch in selectGen -- the original fix for the select-then-slider race
// (reproduced directly: looping select+immediate-slider-set+Apply without a settle delay lost entire
// generator reductions). Reset clears genDraft directly in the reducer, so no epoch-watching effect
// is needed here at all.
export function ReduceGenerator() {
  const { state, dispatch, setGenPmax } = useApp()
  const { network, genPmax, pending, solve, genDraft } = state
  const eff = pending?.genPmax ?? genPmax
  const { gen, mw } = genDraft
  const headingId = useId()
  const rated = gen === null || !network ? 0 : network.gens[gen].pmax_mw
  if (!network) return null
  const selectGen = (next: number | null) => dispatch({ type: 'setGenDraft', gen: next, mw: next === null ? 0 : eff[next] ?? network.gens[next].pmax_mw })
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId}>Reduce generator</h2>
      <label>Generator{' '}
        <select value={gen ?? ''} onChange={e => selectGen(e.target.value === '' ? null : +e.target.value)}>
          <option value="">Select a generator</option>
          {network.gens.map(g => <option key={g.idx} value={g.idx}>Gen {g.idx} at {network.buses[g.bus].name} (rated {g.pmax_mw} MW)</option>)}
        </select>
      </label>
      {gen !== null && (
        <div role="group" aria-label="Generator limit">
          <label>Pmax{' '}
            <input type="range" min={0} max={rated} step={1} value={mw} onChange={e => dispatch({ type: 'setGenDraft', gen, mw: +e.target.value })}
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
