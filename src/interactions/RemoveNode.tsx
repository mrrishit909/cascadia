import { useId, useRef } from 'react'
import { useApp } from '../app/state'
import type { DcopfResult } from '../engine/dcopf'

const mw = (v: number) => `${v.toFixed(2)} MW`

// CAS-INT-001. Pick a bus (SVG bus or the select), Remove -> Confirm/Cancel (Escape cancels), Reset restores baseline.
// selectedBus is already shared AppState (no local draft to lift). NOTE: this component also hosts the
// single "Reset to baseline" button for the whole app -- if RemoveNode is ever dual-mounted (home
// chapter + lab, matching every other control per docs/ART_DIRECTION.md), that button would duplicate
// and getByRole('button', {name: 'Reset to baseline'}) locators across the e2e suite would need
// scoping. Not yet an issue: nothing mounts this twice today. Flagged for the chapter-scaffolding pass.
export function RemoveNode() {
  const { state, dispatch, removeBus } = useApp()
  const { network, result, selectedBus, removedBus, solve, solveError, pending } = state
  const headingId = useId()
  const confirmRef = useRef<HTMLButtonElement>(null)
  if (!network || !result) return null
  const r = result.result as Partial<DcopfResult> & typeof result.result
  const solving = solve === 'solving'
  return (
    <section aria-labelledby={headingId} onKeyDown={e => { if (e.key === 'Escape') dispatch({ type: 'select', bus: null }) }}>
      <h2 id={headingId}>Remove substation</h2>
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
      {/* Reset is safe during an active solve: the epoch guard in state.tsx (see AppState comment) ensures
          that solve's eventual resolution is discarded rather than overwriting the just-reset state when
          it lands. Disabled only when there's genuinely nothing to reset (no confirmed or pending change). */}
      <button disabled={removedBus === null && pending === null && result === state.baseline} onClick={() => dispatch({ type: 'reset' })}>Reset to baseline</button>
      {/* Architecture-stabilization fix: these were role="status"/role="alert" (each an independent
          live region) -- a single solve triggered duplicate screen-reader announcements across every
          mounted control. The shared <StatusRegion/> (App.tsx) is now the only live-announcing
          element; these stay plain text, visually identical, silent to AT. */}
      {solving && <p>Solving island-aware DC-OPF in Worker...</p>}
      {solve === 'error' && <p>Solve failed: {solveError}</p>}
      {r.status === 'infeasible' && <p>Infeasible: {r.diagnostics.join('; ') || 'no feasible dispatch'}</p>}
      {/* Infeasible means no valid dispatch exists at all -- showing "0.00 MW" here would read as
          "fully served", not "undefined". n/a is deliberately not a number. Found by the
          no_fake_numbers_audit task's adversarial review (verification/NO_FAKE_NUMBERS_AUDIT.md #6). */}
      <p>
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
