import { useEffect, useId, useRef, useState } from 'react'
import { useApp } from '../app/state'
import { ScenarioReadout } from './ScenarioReadout'

// CAS-INT-007 (P1). Pick a line, Disable -> Confirm/Cancel (Escape cancels) -> Worker solve (disabled_lines).
// Distinct from capacity (line stays in topology) and bus removal. Restore re-enables a disabled line.
//
// Architecture-stabilization pass: line selection now lives in shared AppState.outageLine (so a second
// mount shows the same selection); confirm-dialog state stays local/transient per instance, since a
// confirm dialog mid-flow in one mounted instance has no meaningful "same state" in another.
//
// Independent review (worktree agent, P1): the local confirm flag used to be a bare boolean, which
// doesn't remember WHICH line it was opened for. Repro: mount home+lab, select line 0 in home and open
// its confirm dialog, then select line 5 in the LAB instance (shared outageLine). Home's dialog stayed
// open but now rendered "Take line 5 out of service?" -- a different instance's selection re-targeted
// an already-open destructive confirmation in THIS instance. `confirmingLine` now stores the specific
// line the dialog was opened for; `confirming` is derived as "dialog open AND still for the current
// shared line", so the dialog auto-closes the instant the shared selection diverges from what this
// instance's user actually confirmed, instead of silently re-pointing at the new one.
export function LineOutage({ placement = 'home' }: { placement?: 'home' | 'lab' } = {}) {
  const { state, dispatch, setLineOutage } = useApp()
  const { network, disabledLines, pending, solve, result, outageLine: line } = state
  const [confirmingLine, setConfirmingLine] = useState<number | null>(null)
  const confirming = confirmingLine !== null && confirmingLine === line
  // If the shared selection moves away from the line THIS instance opened confirm for (another
  // instance changed it, or this instance's own select changed it), drop the stale confirmingLine so a
  // later coincidental re-selection of the same line number can't "resurrect" an old confirm intent.
  useEffect(() => { if (confirmingLine !== null && confirmingLine !== line) setConfirmingLine(null) }, [line, confirmingLine])
  const headingId = useId()
  const confirmRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  // Without this, whichever button triggered a `confirming` transition unmounts and the browser drops
  // focus to <body> -- the section's own onKeyDown Escape handler only catches events bubbling from a
  // DESCENDANT, so an event starting at <body> never reaches it, silently breaking the documented
  // "Escape cancels" behavior for anyone who got here by keyboard (confirmed directly:
  // document.activeElement read back as BODY after pressing Enter on "Disable line"). Covers both
  // directions: entering confirm (focus "Confirm outage") and leaving it via Cancel/Escape (focus
  // "Disable line"/"Restore line" again), not just the first one found.
  //
  // Confirm's own click handler both leaves `confirming` and starts a solve in the same batch, so the
  // trigger button re-renders DISABLED (solve === 'solving') at the exact moment this effect would
  // focus it -- .focus() on a disabled element is a silent no-op, so focus dropped to <body> again,
  // the same bug reached a second way. Deferred via `awaitingTriggerFocus`: if the trigger isn't
  // focusable yet, wait for solve to leave 'solving' and focus it then instead.
  const awaitingTriggerFocus = useRef(false)
  // Dual-mount regression (advisor review): this effect has no initial-mount guard below, so it ALSO
  // fires once on every mount (React runs every effect after the first render, not just on later
  // dependency changes), not just on later `confirming` transitions. outageLine is shared AppState, so
  // mounting a SECOND instance (chapter's lab placement) while a line is already selected renders that
  // instance's own trigger button immediately -- without a guard, the mount-time run of this effect
  // would yank keyboard focus to it regardless of what the user was actually doing elsewhere on the
  // page.
  //
  // Independent review (worktree agent, P2): a one-shot "justMounted" ref flag is the wrong shape for
  // this guard. Under <StrictMode> (main.tsx), React deliberately runs mount -> cleanup -> mount again
  // for every freshly mounted component to surface impure effects; a flag that's already flipped false
  // by the FIRST simulated mount no longer skips the SECOND one, so the focus-steal reappears in dev
  // mode specifically (confirmed: mounting a second instance under StrictMode while a line is already
  // selected still steals focus). Fixed by comparing against the PREVIOUS `confirming` value in a ref
  // instead of a single-use flag: both of StrictMode's simulated mounts observe prevConfirming.current
  // already equal to the current (unchanged) `confirming`, so both correctly skip, while a later GENUINE
  // transition (prevConfirming.current differs from the new value) still runs the focus logic normally.
  const prevConfirming = useRef(confirming)
  useEffect(() => {
    const changed = prevConfirming.current !== confirming
    prevConfirming.current = confirming
    if (!changed) return
    if (confirming) { confirmRef.current?.focus(); return }
    if (triggerRef.current && !triggerRef.current.disabled) triggerRef.current.focus()
    else awaitingTriggerFocus.current = true
  }, [confirming])
  useEffect(() => {
    if (solve !== 'solving' && awaitingTriggerFocus.current) { awaitingTriggerFocus.current = false; triggerRef.current?.focus() }
  }, [solve])
  if (!network) return null
  const off = (pending?.disabledLines ?? disabledLines)
  const out = line !== null && off.includes(line)
  const islands = result?.result.islands.length ?? 0
  return (
    <section data-placement={placement} aria-labelledby={headingId} onKeyDown={e => { if (e.key === 'Escape') setConfirmingLine(null) }}>
      <h2 id={headingId}>Line outage{placement === 'lab' && <span className="sr-only"> (laboratory)</span>}</h2>
      <label>Line to disable{' '}
        <select value={line ?? ''} disabled={solve === 'solving'} onChange={e => { setConfirmingLine(null); dispatch({ type: 'setOutageLine', line: e.target.value === '' ? null : +e.target.value }) }}>
          <option value="">Select a line</option>
          {network.lines.map(l => <option key={l.idx} value={l.idx}>Line {l.idx} ({network.buses[l.from_bus].name}-{network.buses[l.to_bus].name}){off.includes(l.idx) ? ' - OUT' : ''}</option>)}
        </select>
      </label>
      {line !== null && !confirming && <button ref={triggerRef} disabled={solve === 'solving'} onClick={() => out ? setLineOutage(line, false) : setConfirmingLine(line)}>{out ? 'Restore line' : 'Disable line'}</button>}
      {line !== null && confirming && (
        <div role="group" aria-label="Confirm outage">
          <p>Take line {line} out of service? It is removed from the topology.</p>
          <button ref={confirmRef} disabled={solve === 'solving'} onClick={() => { setConfirmingLine(null); void setLineOutage(line, true) }}>Confirm outage</button>
          <button onClick={() => setConfirmingLine(null)}>Cancel</button>
        </div>
      )}
      <p>Lines out: <span data-testid="outage-list">{off.length ? off.join(', ') : 'none'}</span> | Islands: <span data-testid="outage-islands">{islands}</span></p>
      <ScenarioReadout id="outage" />
    </section>
  )
}
