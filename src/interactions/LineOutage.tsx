import { useEffect, useRef, useState } from 'react'
import { useApp } from '../app/state'
import { ScenarioReadout } from './ScenarioReadout'

// CAS-INT-007 (P1). Pick a line, Disable -> Confirm/Cancel (Escape cancels) -> Worker solve (disabled_lines).
// Distinct from capacity (line stays in topology) and bus removal. Restore re-enables a disabled line.
export function LineOutage() {
  const { state, setLineOutage } = useApp()
  const { network, disabledLines, pending, solve, result } = state
  const [line, setLine] = useState<number | null>(null)
  const [confirming, setConfirming] = useState(false)
  const confirmRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  // Without this, whichever button triggered a `confirming` transition unmounts and the browser drops
  // focus to <body> -- the section's own onKeyDown Escape handler only catches events bubbling from a
  // DESCENDANT, so an event starting at <body> never reaches it, silently breaking the documented
  // "Escape cancels" behavior for anyone who got here by keyboard (confirmed directly:
  // document.activeElement read back as BODY after pressing Enter on "Disable line"). Covers both
  // directions: entering confirm (focus "Confirm outage") and leaving it via Cancel/Escape (focus
  // "Disable line"/"Restore line" again), not just the first one found.
  useEffect(() => { (confirming ? confirmRef : triggerRef).current?.focus() }, [confirming])
  if (!network) return null
  const off = (pending?.disabledLines ?? disabledLines)
  const out = line !== null && off.includes(line)
  const islands = result?.result.islands.length ?? 0
  return (
    <section aria-labelledby="lo-h" onKeyDown={e => { if (e.key === 'Escape') setConfirming(false) }}>
      <h2 id="lo-h">Line outage</h2>
      <label>Line to disable{' '}
        <select value={line ?? ''} disabled={solve === 'solving'} onChange={e => { setConfirming(false); setLine(e.target.value === '' ? null : +e.target.value) }}>
          <option value="">Select a line</option>
          {network.lines.map(l => <option key={l.idx} value={l.idx}>Line {l.idx} ({network.buses[l.from_bus].name}-{network.buses[l.to_bus].name}){off.includes(l.idx) ? ' - OUT' : ''}</option>)}
        </select>
      </label>
      {line !== null && !confirming && <button ref={triggerRef} disabled={solve === 'solving'} onClick={() => out ? setLineOutage(line, false) : setConfirming(true)}>{out ? 'Restore line' : 'Disable line'}</button>}
      {line !== null && confirming && (
        <div role="group" aria-label="Confirm outage">
          <p>Take line {line} out of service? It is removed from the topology.</p>
          <button ref={confirmRef} disabled={solve === 'solving'} onClick={() => { setConfirming(false); void setLineOutage(line, true) }}>Confirm outage</button>
          <button onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      )}
      <p>Lines out: <span data-testid="outage-list">{off.length ? off.join(', ') : 'none'}</span> | Islands: <span data-testid="outage-islands">{islands}</span></p>
      <ScenarioReadout id="outage" />
    </section>
  )
}
