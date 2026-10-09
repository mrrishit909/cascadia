import { useApp } from '../app/state'

// Architecture-stabilization fix (advisor review): RemoveNode, AlterCapacity and all 4 call sites of
// ScenarioReadout each used to carry their OWN role="status"/role="alert" element, every one of which
// implicitly becomes a live region (ARIA's default aria-live for those roles). A single solve already
// triggered up to 6 simultaneous screen-reader announcements of the same event; dual-mounting any
// control for chapter + lab would have doubled whichever of those were mounted. DESIGN_SYSTEM.json's
// own componentStates.statusRegion token already specifies ONE shared status region -- this is it,
// mounted exactly once in App.tsx. Every control's own status paragraph stays as plain (non-live)
// text for sighted users; this is the only thing a screen reader actually hears.
//
// Second advisor-review fix: both <p> elements are now ALWAYS mounted (never conditionally returned
// null), with only their text content changing. A live region that gets INSERTED already holding its
// first message is frequently never announced -- screen readers key off a mutation to existing live
// region content, not the region's own appearance. Two permanently-present elements (one role="status",
// one role="alert") rather than one element whose role is swapped in place, since changing an element's
// role is itself unreliably announced across screen readers. Both are `.sr-only`: every control already
// shows these same numbers visibly, so a visible duplicate here would both repeat content and shift
// layout (a CLS risk) every time the text changes.
export function StatusRegion() {
  const { state } = useApp()
  const { result, solve, solveError } = state
  let statusText = ''
  let alertText = ''
  if (solve === 'solving') statusText = 'Solving DC-OPF in Worker...'
  else if (solve === 'error') alertText = `Solve failed: ${solveError}`
  else if (result?.result.status === 'infeasible') alertText = `Infeasible: ${result.result.diagnostics.join('; ') || 'no feasible dispatch'}`
  else if (result) statusText = `Solved: ${result.result.total_unserved_mw.toFixed(2)} MW unserved.`
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only" data-testid="status-region-status">{statusText}</p>
      <p role="alert" className="sr-only" data-testid="status-region-alert">{alertText}</p>
    </>
  )
}
