import { useApp } from '../app/state'

// Single shared live region for CAS-INT-006's restoration subsystem (see StatusRegion.tsx for the
// main scenario's equivalent, and the architecture-stabilization comment there for why this exists).
// Deliberately separate from StatusRegion: restoration has its own Worker/status, independent of the
// main scenario solve, matching the story/lab boundary's subsystem separation
// (docs/planning/cascadia/CHAPTER_ARCHITECTURE.md).
export function RestorationStatusRegion() {
  const { state } = useApp()
  const { status, error, ranking } = state.restoration
  if (status === 'loading') return <p role="status" aria-live="polite">Ranking restoration orders in Worker...</p>
  if (status === 'error') return <p role="alert">Rank failed: {error}</p>
  if (ranking) return <p role="status" aria-live="polite">{ranking.length} restoration orders ranked.</p>
  return null
}
