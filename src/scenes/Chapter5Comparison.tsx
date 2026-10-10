import { useState } from 'react'
import { useApp } from '../app/state'
import { PRESETS } from '../interactions/CompareRestoration'
import { NetworkView } from '../visualization/NetworkView'
import type { DownElement, RestoreSeq } from '../engine/dcopf'
import type { SolveResult } from '../engine/types'

// The mini networks only have AGGREGATE served/unserved MW per step (RestoreStep carries no per-bus
// or per-line detail) -- a minimal, honest result object with EMPTY shed/islands/flows/binding_lines,
// so NetworkView shows ONLY the one thing actually known (which elements are still down, via
// removedBuses/disabledLines), never fabricated per-bus shed/binding detail borrowed from an unrelated
// baseline or live result. The real aggregate number is shown separately, in the step chart/label.
const EMPTY_RESULT: SolveResult = { status: 'optimal', flows: {}, line_rating_mw: {}, gen: {}, shed: {}, islands: [], binding_lines: [], diagnostics: [], total_load_mw: 0, total_unserved_mw: 0, objective: 0 }

const COLUMNS = 3

// ART_DIRECTION.md section 3, chapter 5 ("recovery plans", comparative view): "Three equal columns
// (small multiples), one per restoration sequence from the fixture. Each column has a mini network
// plus a served-MW step chart on a SHARED y-axis, and the columns are ranked by served energy... A
// step control advances all three in sync." Motion table row 5: trigger is "User presses STEP /
// selects a sequence (not scroll)... All three columns share one step index and one timeline...
// reduced motion: Instant step." No scroll-scrub, no GSAP timeline -- a step index is discrete,
// user-driven state (closer to a feedback/state transition than continuous motion), so this is a
// plain React component with a CSS transition on the step-chart bars, not a `useScene` scene.
//
// Reads CAS-INT-006's OWN ranked output (`state.restoration.ranking`, populated by CompareRestoration's
// "Compare" button) -- never a second, duplicated ranking computation. `order`/`steps[].restored` are
// INDICES into the preset's own `down: DownElement[]` array (engine/dcopf.ts's own restorationSequence
// comment), not raw bus/line ids -- `stillDown` below does that translation once, the single place
// chapter 5 and nowhere else needs to know it.
function stillDown(down: DownElement[], order: number[], step: number): DownElement[] {
  const restoredIdx = new Set(order.slice(0, step))
  return down.filter((_, i) => !restoredIdx.has(i))
}

export function Chapter5Comparison() {
  const { state } = useApp()
  const { network, restoration } = state
  const [step, setStep] = useState(0)
  if (!network) return null
  const ranking = restoration.ranking
  const preset = PRESETS.find(p => p.id === (restoration.presetId || PRESETS[0].id))!
  const k = preset.down.length
  const maxStep = k

  if (!ranking) {
    return (
      <div className="ch5-comparison" data-testid="ch5-comparison">
        <p className="chapter-prose" data-testid="ch5-empty">Run Compare above to rank restoration sequences for this fault scenario.</p>
      </div>
    )
  }

  const top = ranking.slice(0, COLUMNS)
  const maxServed = Math.max(...top.map((s: RestoreSeq) => s.final_served_mw), 1) // shared y-axis across all 3 columns

  return (
    <div className="ch5-comparison" data-testid="ch5-comparison">
      <div className="ch5-step-control">
        <button type="button" data-testid="ch5-step-prev" disabled={step === 0} onClick={() => setStep(s => Math.max(0, s - 1))}>Previous step</button>
        <span data-testid="ch5-step-label">Step {step} of {maxStep}</span>
        <button type="button" data-testid="ch5-step-next" disabled={step === maxStep} onClick={() => setStep(s => Math.min(maxStep, s + 1))}>Step</button>
        <button type="button" data-testid="ch5-step-reset" onClick={() => setStep(0)} disabled={step === 0}>Reset</button>
      </div>
      <div className="ch5-columns">
        {top.map((seq: RestoreSeq, col: number) => {
          const down = stillDown(preset.down, seq.order, step)
          const downBuses = down.filter(e => e.kind === 'bus').map(e => e.id)
          const downLines = down.filter(e => e.kind === 'line').map(e => e.id)
          const servedNow = seq.steps[step]?.served_mw ?? 0
          return (
            <div key={col} className="ch5-column" data-testid="ch5-column" data-rank={seq.rank}>
              <p className="ch5-column-label">Rank {seq.rank}: order [{seq.order.join(', ')}]</p>
              <div className="ch5-mini-network">
                <NetworkView network={network} result={EMPTY_RESULT}
                  removedBuses={downBuses} disabledLines={downLines} interactive={false} />
              </div>
              <div className="ch5-step-chart" role="img" aria-label={`Served MW by step: ${seq.steps.map(s => s.served_mw.toFixed(1)).join(', ')} MW`}>
                {seq.steps.map(s => (
                  <div key={s.step} className="ch5-step-bar-track">
                    <div className="ch5-step-bar" data-testid="ch5-step-bar" data-step={s.step}
                      data-current={s.step === step}
                      style={{ height: `${Math.max(2, (s.served_mw / maxServed) * 100)}%` }} />
                  </div>
                ))}
              </div>
              <p className="ch5-served-now" data-testid="ch5-served-now">{servedNow.toFixed(2)} MW served at step {step}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
