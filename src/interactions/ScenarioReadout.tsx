import { useApp } from '../app/state'

// Reset is the single shared 'Reset to baseline' button in RemoveNode (clears all fields).
// Shared status block for the CAS-INT-002/003/007 controls. Every number is from the latest Worker result;
// infeasible shows n/a, never 0.00 (see NO_FAKE_NUMBERS_AUDIT #6).
export function ScenarioReadout({ id }: { id: string }) {
  const { state } = useApp()
  const { result, solve, solveError } = state
  if (!result) return null
  const r = result.result
  const shed = Object.entries(r.shed).filter(([, v]) => v > 0)
  return (
    <>
      {solve === 'solving' && <p role="status">Solving DC-OPF in Worker...</p>}
      {solve === 'error' && <p role="alert">Solve failed: {solveError}</p>}
      {r.status === 'infeasible' && <p role="alert">Infeasible: {r.diagnostics.join('; ') || 'no feasible dispatch'}</p>}
      <p role="status" aria-live="polite">
        Unserved: <strong data-testid={`${id}-unserved`}>{r.status === 'infeasible' ? 'n/a (infeasible)' : `${r.total_unserved_mw.toFixed(2)} MW`}</strong>
        {r.status !== 'infeasible' && <> | Shed at buses: <span data-testid={`${id}-shed`}>{shed.length ? shed.map(([b, v]) => `${state.network?.buses[+b].name ?? b} ${v.toFixed(2)} MW`).join(', ') : 'none'}</span></>}
      </p>
    </>
  )
}
