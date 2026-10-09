import { useEffect, useId, useRef } from 'react'
import { useApp } from '../app/state'

const DEBOUNCE_MS = 250

// CAS-INT-005. Pick a line (SVG line or select), drag/arrow the capacity slider; a debounced Worker solve
// refreshes binding status. Reset (shared) restores the exact baseline object.
// allow_shed: DEFAULTS TO TRUE, matching RemoveNode and the engine default, so the LP stays feasible and the
// user sees shed MW. The checkbox lets users turn shedding off, which is the only way to reach the genuine
// infeasible diagnostic (e.g. line 9 at 0.25x, public/data/scenarios/infeasible.json) through this control.
//
// Architecture-stabilization pass: {factor, allowShed} now live in shared AppState.capDraft (selectedLine
// was already shared), so a second mount (home chapter 3 + chapter 6's laboratory) shows the identical
// draft rather than its own stale copy. The debounce timer and `awaitingOwnLine` stay instance-local
// (refs can't be shared state, and don't need to be: whichever mounted instance the user is actually
// interacting with owns firing the debounced Worker call; the shared draft value means both instances
// display the same thing regardless of which one is doing the firing).
export function AlterCapacity() {
  const { state, dispatch, setCapacity } = useApp()
  const { network, result, selectedLine, pending, solve, solveError, capDraft, epoch } = state
  const { factor, allowShed } = capDraft
  const headingId = useId()
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
  // Architecture-stabilization fix: the draft resync on line-change/reset used to be TWO per-component
  // effects here (one keyed on `selectedLine`, one on `atBaseline`). With this control mounted twice
  // (home chapter 3 + lab), each mounted instance ran its OWN copy -- harmless when both computed the
  // same value, but a real bug on (re)mount: a newly (re)mounted instance's effect fires with the
  // last-confirmed value and can clobber a draft the user is actively editing in the OTHER instance,
  // since both write the same shared capDraft. Moved into the `selectLine` reducer case instead (one
  // atomic update, no per-instance effect to double-fire or fire late on mount); `reset` already resets
  // capDraft directly in the reducer. Only the local debounce timer needs clearing here, on both edges.
  useEffect(() => { clearTimeout(timer.current) }, [selectedLine, epoch])
  // Re-sync once OUR OWN pending solve lands, so the slider/checkbox don't keep showing a stale
  // pre-solve draft after it resolves (N2's second half) -- but ONLY our own, and ONLY if the user
  // hasn't since switched to a different line: resyncing on *any* pending resolution (e.g. an
  // unrelated bus removal finishing, or a stale reply for a line the user already navigated away
  // from) was clearing an in-progress LOCAL debounce timer or overwriting the new line's draft with
  // the old line's resolved value. `awaitingOwnLine` is set to the line a debounced request was
  // actually fired for (not scheduled for), and cleared whenever selectedLine changes.
  //
  // Residual, accepted risk (documented, not silently ignored): if a SECOND mounted instance has its
  // OWN uncommitted draft for a DIFFERENT, not-yet-sent edit to the same line when THIS instance's
  // pending solve resolves, this resync still overwrites the shared capDraft with the now-stale
  // resolved value, clobbering that other draft. Fully solving concurrent cross-instance editing of
  // the exact same field within the same ~250ms window is out of scope for this pass; the far more
  // common trigger (a (re)mount's OWN effect firing stale) is what the reducer fix above closes.
  const awaitingOwnLine = useRef<number | null>(null)
  useEffect(() => { awaitingOwnLine.current = null }, [selectedLine])
  useEffect(() => {
    if (pending === null && awaitingOwnLine.current !== null && awaitingOwnLine.current === selectedLine) {
      awaitingOwnLine.current = null
      dispatch({ type: 'selectLine', line: selectedLine }) // re-reads capDraft from the now-confirmed state
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
    <section aria-labelledby={headingId}>
      <h2 id={headingId}>Alter line capacity</h2>
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
              onChange={e => { dispatch({ type: 'setCapDraft', factor: +e.target.value, allowShed }); fire(+e.target.value, allowShed) }} />
          </label>
          <output data-testid="cap-factor">{factor.toFixed(2)}x</output>{' '}
          <span data-testid="cap-rating">{(line.rating_mw * factor).toFixed(1)} MW rating</span>
          <label><input type="checkbox" checked={allowShed} onChange={e => { dispatch({ type: 'setCapDraft', factor, allowShed: e.target.checked }); fire(factor, e.target.checked) }} /> Allow load shedding</label>
        </div>
      )}
      {/* Architecture-stabilization fix: these were role="status"/role="alert" (each an independent
          live region) -- a single solve triggered duplicate screen-reader announcements across every
          mounted control. The shared <StatusRegion/> (App.tsx) is now the only live-announcing
          element; these stay plain text, visually identical, silent to AT. */}
      {solving && <p>Solving DC-OPF in Worker...</p>}
      {solve === 'error' && <p>Solve failed: {solveError}</p>}
      {r.status === 'infeasible' && <p>Infeasible: {r.diagnostics.join('; ') || 'no feasible dispatch'}</p>}
      {/* Infeasible means no valid dispatch exists; "0.00 MW" would read as "fully served". n/a is
          deliberately not a number. Found by no_fake_numbers_audit's adversarial review
          (verification/NO_FAKE_NUMBERS_AUDIT.md #6). */}
      <p>
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
