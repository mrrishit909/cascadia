import type { Case30, SolveResult } from '../engine/types'

export const RAIL_COUNT = 4

// ART_DIRECTION.md section 3, chapter 3's fixed rail set: "the baseline fixture's 4 most-loaded
// lines (by |flow| / rating)." Computed ONCE from the baseline fixture (never the live/diverged
// result -- the rail SET must not reshuffle under the user's hands as they alter capacity, per the
// spec's own "keeping the order fixed stops the comparison from reshuffling" note), order frozen.
export function computeBaselineRails(network: Case30, baseline: SolveResult): number[] {
  return network.lines
    .map(l => ({ idx: l.idx, ratio: Math.abs(baseline.flows[l.idx] ?? 0) / (baseline.line_rating_mw[l.idx] ?? (l.rating_mw || 1)) }))
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, RAIL_COUNT)
    .map(r => r.idx)
}

function railReadout(network: Case30, result: SolveResult, idx: number) {
  const line = network.lines[idx]
  const infeasible = result.status === 'infeasible'
  const binding = result.binding_lines.includes(idx)
  const flow = Math.abs(result.flows[idx] ?? 0)
  const rating = result.line_rating_mw[idx] ?? line.rating_mw
  return {
    line,
    label: `Line ${idx} (${network.buses[line.from_bus].name}-${network.buses[line.to_bus].name})`,
    flowText: infeasible ? 'n/a (infeasible)' : `${flow.toFixed(2)} of ${rating.toFixed(2)} MW`,
    binding,
    infeasible,
    flow,
    rating,
  }
}

// ART_DIRECTION.md section 3: the fixed rails, a 5th INSPECTED rail for whatever line the user has
// selected (AlterCapacity's own `state.selectedLine` -- the SAME selection, not a second source of
// truth), and an "ALSO AT LIMIT" list for any binding line that isn't already shown. Always mounted
// (project's standing rule), shown/hidden via `inert`+CSS driven directly by `active`, matching
// FigIndex/SkipIntro/LegendPlate's own convention. Rail GEOMETRY (the SVG <line> each row owns, data-
// testid="rail-line") is animated externally by Chapter3Scene -- this component only renders the
// static DOM structure and real readout text/buttons; it never computes or owns scroll-driven state.
export function CorridorStrip({ active, network, result, railIds, selectedLine, onSelectLine }: {
  active: boolean
  network: Case30
  result: SolveResult
  railIds: number[]
  selectedLine: number | null
  onSelectLine: (line: number) => void
}) {
  const inspectedExtra = selectedLine !== null && !railIds.includes(selectedLine) ? selectedLine : null
  const shown = inspectedExtra !== null ? [...railIds, inspectedExtra] : railIds
  const alsoAtLimit = result.status === 'infeasible' ? [] : result.binding_lines.filter(i => !shown.includes(i))

  return (
    <div className="corridor-strip" data-active={active} inert={!active}>
      <ol className="corridor-rails">
        {shown.map((idx, row) => {
          const r = railReadout(network, result, idx)
          const isInspected = idx === inspectedExtra
          return (
            <li key={idx} data-testid="rail" data-rail-line={idx} data-rail-row={row}>
              <svg className="rail-line-svg" data-testid="rail-line-svg" data-rail-line={idx} aria-hidden="true">
                <line data-testid="rail-line" data-rail-line={idx} x1={0} y1={0} x2={0} y2={0}
                  stroke={r.binding ? 'var(--copper-hot)' : 'var(--copper)'} strokeWidth={r.binding ? 3 : 2} />
                {!r.infeasible && (
                  <line data-testid="rail-tick" data-rail-line={idx} x1={0} y1={-6} x2={0} y2={6} stroke="var(--text-secondary)" strokeWidth={1} />
                )}
              </svg>
              <button type="button" className="rail-readout" data-testid="rail-readout" aria-pressed={selectedLine === idx}
                onClick={() => onSelectLine(idx)}>
                <span className="rail-label">{isInspected ? 'Inspected: ' : ''}{r.label}</span>
                <span className="rail-value" data-testid="rail-flow" data-flow-mw={r.infeasible ? 0 : r.flow} data-rating-mw={r.rating}>{r.flowText}</span>
                {r.binding && <span className="rail-badge">Binding</span>}
              </button>
            </li>
          )
        })}
        {inspectedExtra === null && (
          <li className="rail-empty" data-testid="rail-empty-inspected">Inspected: none selected</li>
        )}
      </ol>
      {alsoAtLimit.length > 0 && (
        <div className="corridor-also-at-limit">
          <p className="corridor-also-label">Also at limit</p>
          <ul>
            {alsoAtLimit.map(idx => (
              <li key={idx}>
                <button type="button" data-testid="also-at-limit" onClick={() => onSelectLine(idx)}>
                  Line {idx} ({network.buses[network.lines[idx].from_bus].name}-{network.buses[network.lines[idx].to_bus].name})
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
