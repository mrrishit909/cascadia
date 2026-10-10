import type { Precomputed } from '../engine/types'

// ART_DIRECTION.md section 3, chapter 2: "A generation/demand balance rule spans the prose column."
// Two rows, crossfaded by Chapter2Scene's scroll-scrub (geometry/opacity only, per the motion
// table's "balance scrub linear" -- NOT a progress-derived number, which would violate the project's
// hard no-count-up rule: "Balance totals are static fixture text"). Figures read straight from
// state.baseline.result -- the baseline fixture, matching the table's note that totals stay fixture
// values throughout the scrub, never the live (possibly diverged) result.
export function BalanceRule({ baseline }: { baseline: Precomputed }) {
  const totalGen = Object.values(baseline.result.gen).reduce((a, b) => a + b, 0)
  const totalDemand = baseline.result.total_load_mw
  return (
    <div className="balance-rule">
      <div className="balance-rule-row" data-testid="balance-gen"><span>Generation</span><span>{totalGen.toFixed(1)} MW</span></div>
      <div className="balance-rule-row" data-testid="balance-demand"><span>Demand</span><span>{totalDemand.toFixed(1)} MW</span></div>
    </div>
  )
}
