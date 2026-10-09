import { useRef } from 'react'
import { useApp } from '../app/state'
import type { DcopfResult } from '../engine/dcopf'

const mw = (v: number) => `${v.toFixed(2)} MW`

// CAS-INT-001. Pick a bus (SVG bus or the select), Remove -> Confirm/Cancel (Escape cancels), Reset restores baseline.
export function RemoveNode() {
  const { state, dispatch, removeBus } = useApp()
  const { network, result, selectedBus, removedBus, solve, solveError } = state
  const confirmRef = useRef<HTMLButtonElement>(null)
  if (!network || !result) return null
  const r = result.result as Partial<DcopfResult> & typeof result.result
  const solving = solve === 'solving'
  return (
    <section aria-labelledby="rn-h" onKeyDown={e => { if (e.key === 'Escape') dispatch({ type: 'select', bus: null }) }}>
      <h2 id="rn-h">Remove substation</h2>
      <label>Bus{' '}
        <select value={selectedBus ?? ''} disabled={solving}
          onChange={e => dispatch({ type: 'select', bus: e.target.value === '' ? null : +e.target.value })}>
          <option value="">Select a bus</option>
          {network.buses.map(b => <option key={b.idx} value={b.idx}>{b.name}</option>)}
        </select>
      </label>
      {selectedBus !== null && (
        <div role="group" aria-label="Confirm removal">
          <p>Remove bus {network.buses[selectedBus].name}? Lines to it go out of service.</p>
          <button ref={confirmRef} disabled={solving} onClick={() => removeBus(selectedBus)}>Confirm removal</button>
          <button disabled={solving} onClick={() => dispatch({ type: 'select', bus: null })}>Cancel</button>
        </div>
      )}
      <button disabled={solving || (removedBus === null && result === state.baseline)} onClick={() => dispatch({ type: 'reset' })}>Reset to baseline</button>
      {solving && <p role="status">Solving island-aware DC-OPF in Worker...</p>}
      {solve === 'error' && <p role="alert">Solve failed: {solveError}</p>}
      {r.status === 'infeasible' && <p role="alert">Infeasible: {r.diagnostics.join('; ') || 'no feasible dispatch'}</p>}
      {/* Infeasible means no valid dispatch exists at all -- showing "0.00 MW" here would read as
          "fully served", not "undefined". n/a is deliberately not a number. Found by the
          no_fake_numbers_audit task's adversarial review (verification/NO_FAKE_NUMBERS_AUDIT.md #6). */}
      <p role="status" aria-live="polite">
        {removedBus !== null && <>Bus {network.buses[removedBus].name} unavailable. </>}
        Unserved: <strong data-testid="unserved-mw">{r.status === 'infeasible' ? 'n/a (infeasible)' : mw(r.total_unserved_mw)}</strong>
      </p>
      {r.status !== 'infeasible' && r.shed_no_generation_mw !== undefined && (
        <ul>
          <li data-testid="unserved-removed">Load at removed bus: {mw(r.unserved_removed_mw ?? 0)}</li>
          <li data-testid="shed-no-generation">Shed, island has no generation: {mw(r.shed_no_generation_mw)}</li>
          <li data-testid="shed-economic">Shed, economic (VOLL): {mw(r.shed_economic_mw ?? 0)}</li>
        </ul>
      )}
    </section>
  )
}
