import { useId } from 'react'
import { useApp } from '../app/state'
import { ScenarioReadout } from './ScenarioReadout'

// CAS-INT-004. Add a SYNTHETIC candidate line (candidate_lines.json, labeled not part of the real IEEE
// case30 topology) -> real Worker solve (added_lines). Toggle directly from the SVG or this list.
// No local draft to lift (addedLines is already shared AppState).
export function AddLine({ placement }: { placement: 'home' | 'lab' }) {
  const { state, setAddedLine } = useApp()
  const { network, candidates, pending, addedLines, solve } = state
  const eff = pending?.addedLines ?? addedLines
  const headingId = useId()
  if (!network) return null
  return (
    <section data-placement={placement} aria-labelledby={headingId}>
      <h2 id={headingId}>Add transmission line{placement === 'lab' && <span className="sr-only"> (laboratory)</span>}</h2>
      <p>{candidates.length} SYNTHETIC candidate lines (not part of the real IEEE case30 topology; see <code>public/data/raw-metadata/candidate_lines.json</code>).</p>
      <ul>
        {candidates.map((cl, k) => {
          const added = eff.includes(k)
          return (
            <li key={k}>
              <button disabled={solve === 'solving'} onClick={() => setAddedLine(k, !added)} aria-pressed={added}>
                {added ? 'Remove' : 'Add'} line {k}: {network.buses[cl.from_bus].name}-{network.buses[cl.to_bus].name} (rated {cl.rating_mw} MW)
              </button>
              {added && <span> -- added</span>}
            </li>
          )
        })}
      </ul>
      <ScenarioReadout id="addline" />
    </section>
  )
}
