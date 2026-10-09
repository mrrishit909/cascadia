import { useApp } from '../app/state'

// Architecture-stabilization fix (advisor review): RemoveNode, AlterCapacity and all 4 call sites of
// ScenarioReadout each used to carry their OWN role="status"/role="alert" element, every one of which
// implicitly becomes a live region (ARIA's default aria-live for those roles). A single solve already
// triggered up to 6 simultaneous screen-reader announcements of the same event; dual-mounting any
// control for chapter + lab would have doubled whichever of those were mounted. DESIGN_SYSTEM.json's
// own componentStates.statusRegion token already specifies ONE shared status region -- this is it,
// mounted exactly once in App.tsx. Every control's own status paragraph stays as plain (non-live)
// text for sighted users; this is the only thing a screen reader actually hears.
export function StatusRegion() {
  const { state } = useApp()
  const { result, solve, solveError } = state
  if (solve === 'solving') return <p role="status" aria-live="polite">Solving DC-OPF in Worker...</p>
  if (solve === 'error') return <p role="alert">Solve failed: {solveError}</p>
  if (result?.result.status === 'infeasible') return <p role="alert">Infeasible: {result.result.diagnostics.join('; ') || 'no feasible dispatch'}</p>
  if (!result) return null
  return <p role="status" aria-live="polite">Solved: {result.result.total_unserved_mw.toFixed(2)} MW unserved.</p>
}
