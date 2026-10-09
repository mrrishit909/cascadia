import { useApp } from '../app/state'

// Single shared live region for CAS-INT-006's restoration subsystem (see StatusRegion.tsx for the
// main scenario's equivalent, and the architecture-stabilization comment there for why this exists,
// including the always-mounted/text-only-changes and `.sr-only` reasoning from the second advisor
// review pass). Deliberately separate from StatusRegion: restoration has its own Worker/status,
// independent of the main scenario solve, matching the story/lab boundary's subsystem separation
// (docs/planning/cascadia/CHAPTER_ARCHITECTURE.md).
export function RestorationStatusRegion() {
  const { state } = useApp()
  const { status, error, ranking } = state.restoration
  let statusText = ''
  let alertText = ''
  if (status === 'loading') statusText = 'Ranking restoration orders in Worker...'
  else if (status === 'error') alertText = `Rank failed: ${error}`
  else if (ranking) statusText = `${ranking.length} restoration orders ranked.`
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only" data-testid="restoration-status-region-status">{statusText}</p>
      <p role="alert" className="sr-only" data-testid="restoration-status-region-alert">{alertText}</p>
    </>
  )
}
