import { useApp } from '../app/state'

// Reset is the single shared 'Reset to baseline' button in RemoveNode (clears all fields).
// Shared status block for the CAS-INT-002/003/007 controls. Every number is from the latest Worker result;
// infeasible shows n/a, never 0.00 (see NO_FAKE_NUMBERS_AUDIT #6).
//
// Architecture-stabilization fix: these used to be role="status"/role="alert" elements -- each one an
// independent live region, so a single solve triggered a duplicate screen-reader announcement per
// mounted control (and would double again on dual-mount). The single shared <StatusRegion/> (App.tsx)
// is now the only live-announcing element; this stays plain text, visually identical, silent to AT.
export function ScenarioReadout({ id }: { id: string }) {
  const { state } = useApp()
  const { result, solve, solveError } = state
  if (!result) return null
  const r = result.result
  const shed = Object.entries(r.shed).filter(([, v]) => v > 0)
  return (
    <>
      {solve === 'solving' && <p>Solving DC-OPF in Worker...</p>}
      {solve === 'error' && <p>Solve failed: {solveError}</p>}
      {r.status === 'infeasible' && <p>Infeasible: {r.diagnostics.join('; ') || 'no feasible dispatch'}</p>}
      <p>
        Unserved: <strong data-testid={`${id}-unserved`}>{r.status === 'infeasible' ? 'n/a (infeasible)' : `${r.total_unserved_mw.toFixed(2)} MW`}</strong>
        {r.status !== 'infeasible' && <> | Shed at buses: <span data-testid={`${id}-shed`}>{shed.length ? shed.map(([b, v]) => `${state.network?.buses[+b].name ?? b} ${v.toFixed(2)} MW`).join(', ') : 'none'}</span></>}
      </p>
    </>
  )
}
