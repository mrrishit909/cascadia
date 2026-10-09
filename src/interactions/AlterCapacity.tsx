import { useEffect, useRef, useState } from 'react'
import { useApp } from '../app/state'

const DEBOUNCE_MS = 250

// CAS-INT-005. Pick a line (SVG line or select), drag/arrow the capacity slider; a debounced Worker solve
// refreshes binding status. Reset (shared) restores the exact baseline object.
// allow_shed: DEFAULTS TO TRUE, matching RemoveNode and the engine default, so the LP stays feasible and the
// user sees shed MW. The checkbox lets users turn shedding off, which is the only way to reach the genuine
// infeasible diagnostic (e.g. line 9 at 0.25x, public/data/scenarios/infeasible.json) through this control.
export function AlterCapacity() {
  const { state, dispatch, setCapacity } = useApp()
  const { network, result, baseline, selectedLine, lineCapacity, pending, solve, solveError } = state
  // N2 fix: prefer the in-flight scenario's capacity over the last-confirmed one when re-syncing the
  // slider, so re-selecting a line whose change is still solving shows what's actually been requested,
  // not a stale pre-change value that then silently becomes the base for the next edit.
  const effectiveCapacity = pending?.lineCapacity ?? lineCapacity
  const effectiveAllowShed = pending?.allowShed ?? state.allowShed
  const [factor, setFactor] = useState(1)
  // Local draft, for immediate UI feedback rather than waiting out the 250ms debounce -- same reasoning
  // as `factor`, and resynced on the exact same occasions (line change, reset, pending resolution) from
  // effectiveAllowShed rather than from the last-confirmed value alone (N1/N2's same staleness class).
  const [allowShed, setAllowShed] = useState(true)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  // The debounce timer schedules its call 250ms in the future; if it captured
  // `setCapacity` directly, a removal confirmed during that window would still
  // fire the OLD (pre-removal) closure when the timer elapses, rebuilding its
  // request from stale state and silently dropping the removal -- the same bug
  // class as D1, reached through the debounce window instead of a direct call.
  // Routing through a ref kept current every render means the deferred call
  // always uses the latest setCapacity, whose own closure reads the latest
  // pending/confirmed scenario via base().
  const setCapacityRef = useRef(setCapacity)
  useEffect(() => { setCapacityRef.current = setCapacity }, [setCapacity])
  const atBaseline = result === baseline
  // Re-sync the draft on line change or on an actual reset (baseline newly true) only -- NOT on every
  // atBaseline toggle. atBaseline also flips false->true->false from OTHER controls' unrelated solves
  // (e.g. a bus removal moving `result` away from `baseline`); resyncing on that edge too was clobbering
  // an in-progress slider draft back to the last-committed value, silently discarding the user's not-yet-
  // debounced capacity change. Same bug class as D1 (a confirmed/in-progress action overwritten by a
  // stale resync), reached through this effect instead of request construction.
  const resync = (sel: number | null) => {
    clearTimeout(timer.current)
    setFactor(sel === null ? 1 : effectiveCapacity[sel] ?? 1)
    setAllowShed(effectiveAllowShed)
  }
  const wasAtBaseline = useRef(atBaseline)
  useEffect(() => {
    const justReset = atBaseline && !wasAtBaseline.current
    wasAtBaseline.current = atBaseline
    if (justReset) resync(selectedLine)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atBaseline])
  useEffect(() => resync(selectedLine),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedLine])
  // Re-sync once OUR OWN pending solve lands, so the slider/checkbox don't keep showing a stale
  // pre-solve draft after it resolves (N2's second half) -- but ONLY our own, and ONLY if the user
  // hasn't since switched to a different line: resyncing on *any* pending resolution (e.g. an
  // unrelated bus removal finishing, or a stale reply for a line the user already navigated away
  // from) was clearing an in-progress LOCAL debounce timer or overwriting the new line's draft with
  // the old line's resolved value. `awaitingOwnLine` is set to the line a debounced request was
  // actually fired for (not scheduled for), and cleared whenever selectedLine changes.
  const awaitingOwnLine = useRef<number | null>(null)
  useEffect(() => { awaitingOwnLine.current = null }, [selectedLine])
  useEffect(() => {
    if (pending === null && awaitingOwnLine.current !== null && awaitingOwnLine.current === selectedLine) {
      awaitingOwnLine.current = null
      resync(selectedLine)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending])
  useEffect(() => () => clearTimeout(timer.current), [])
  if (!network || !result) return null
  const solving = solve === 'solving'
  const r = result.result
  const line = selectedLine === null ? null : network.lines[selectedLine]
  const fire = (f: number, shed: boolean) => {
    clearTimeout(timer.current)
    if (selectedLine !== null) {
      const line = selectedLine
      timer.current = setTimeout(() => {
        awaitingOwnLine.current = line
        void setCapacityRef.current(line, f, shed)
      }, DEBOUNCE_MS)
    }
  }
  return (
    <section aria-labelledby="ac-h">
      <h2 id="ac-h">Alter line capacity</h2>
      <label>Line{' '}
        <select value={selectedLine ?? ''} onChange={e => dispatch({ type: 'selectLine', line: e.target.value === '' ? null : +e.target.value })}>
          <option value="">Select a line</option>
          {network.lines.map(l => <option key={l.idx} value={l.idx}>Line {l.idx} ({network.buses[l.from_bus].name}-{network.buses[l.to_bus].name})</option>)}
        </select>
      </label>
      {line && (
        <div role="group" aria-label="Capacity">
          <label>Capacity factor{' '}
            <input type="range" min={0.1} max={2} step={0.05} value={factor}
              aria-valuetext={`${factor.toFixed(2)}x, ${(line.rating_mw * factor).toFixed(1)} MW`}
              onChange={e => { setFactor(+e.target.value); fire(+e.target.value, allowShed) }} />
          </label>
          <output data-testid="cap-factor">{factor.toFixed(2)}x</output>{' '}
          <span data-testid="cap-rating">{(line.rating_mw * factor).toFixed(1)} MW rating</span>
          <label><input type="checkbox" checked={allowShed} onChange={e => { setAllowShed(e.target.checked); fire(factor, e.target.checked) }} /> Allow load shedding</label>
        </div>
      )}
      {solving && <p role="status">Solving DC-OPF in Worker...</p>}
      {solve === 'error' && <p role="alert">Solve failed: {solveError}</p>}
      {r.status === 'infeasible' && <p role="alert">Infeasible: {r.diagnostics.join('; ') || 'no feasible dispatch'}</p>}
      {/* Infeasible means no valid dispatch exists; "0.00 MW" would read as "fully served". n/a is
          deliberately not a number. Found by no_fake_numbers_audit's adversarial review
          (verification/NO_FAKE_NUMBERS_AUDIT.md #6). */}
      <p role="status" aria-live="polite">
        {r.status === 'infeasible' ? (
          <>Binding lines: <strong data-testid="binding-lines">n/a (infeasible)</strong>
          {' '}| Unserved: <strong data-testid="cap-unserved">n/a (infeasible)</strong></>
        ) : (
          <>Binding lines: <strong data-testid="binding-lines">{r.binding_lines.length ? r.binding_lines.join(', ') : 'none'}</strong>
          {' '}| Unserved: <strong data-testid="cap-unserved">{r.total_unserved_mw.toFixed(2)} MW</strong>
          {line && <> | Line {line.idx} flow: <span data-testid="cap-flow">{Math.abs(r.flows[line.idx] ?? 0).toFixed(2)} MW</span></>}
          </>
        )}
      </p>
    </section>
  )
}
