import { useEffect, useRef, useState } from 'react'
import { useApp } from '../app/state'
import { createLpClient, SupersededError } from '../workers/lpClient'
import type { DownElement, RestoreSeq } from '../engine/dcopf'

// CAS-INT-006. Presets mirror research/evaluate/add_line_restoration.py's RESTORE dict exactly (pinned
// by e2e/compareRestoration.spec.ts against verification/REFERENCE_RESULTS/add_line_restoration.json).
const PRESETS: { id: string; label: string; down: DownElement[] }[] = [
  { id: 'island_pocket_plus_line9', label: 'Island pocket + line 9 (3 down)', down: [{ kind: 'line', id: 36 }, { kind: 'line', id: 37 }, { kind: 'line', id: 9 }] },
  { id: 'bus_and_lines', label: 'Bus 26 + two lines (3 down)', down: [{ kind: 'bus', id: 26 }, { kind: 'line', id: 34 }, { kind: 'line', id: 9 }] },
  { id: 'two_buses', label: 'Two buses (2 down)', down: [{ kind: 'bus', id: 11 }, { kind: 'bus', id: 26 }] },
  { id: 'k5_mixed', label: 'Mixed k=5 (5 down, 120 orders)', down: [{ kind: 'line', id: 36 }, { kind: 'line', id: 37 }, { kind: 'line', id: 9 }, { kind: 'bus', id: 11 }, { kind: 'line', id: 3 }] },
]
const TOP_SHOWN = 5
const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1))

// Deliberately NOT routed through the shared base()/pendingRef scenario machinery in state.tsx: this is
// a standalone "what if" query over a hypothetical fault, not a mutation of the app's current scenario.
// It also gets its OWN private Worker/lpClient rather than reusing the shared one -- lpClient's
// latest-wins supersede queue rejects every other pending request the instant a new one fires, so a
// rank() query sharing the main queue would silently cancel (and permanently hang, since
// SupersededError is swallowed without clearing `solve`/`pending`) any other control's in-flight solve.
// Confirmed directly as a real D1-class bug before this isolation was added.
function useRankClient() {
  const ref = useRef<ReturnType<typeof createLpClient>>(undefined)
  const workerRef = useRef<Worker>(undefined)
  useEffect(() => () => workerRef.current?.terminate(), [])
  return () => {
    if (!ref.current) {
      workerRef.current = new Worker(new URL('../workers/lpWorker.ts', import.meta.url), { type: 'module' })
      ref.current = createLpClient(workerRef.current as never)
    }
    return ref.current
  }
}

export function CompareRestoration() {
  const { state } = useApp()
  const { network, candidates } = state
  const getClient = useRankClient()
  const [presetId, setPresetId] = useState(PRESETS[0].id)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [error, setError] = useState<string>()
  const [ranking, setRanking] = useState<RestoreSeq[]>()
  const [chosen, setChosen] = useState(0) // index into `ranking`
  // StrictMode (main.tsx) double-invokes effects in dev: mount -> cleanup -> mount again. A plain
  // `useRef(true)` initializer only runs once, so the FIRST mount's cleanup would permanently flip this
  // to false and the second (real) mount would never set it back -- Compare then hangs on "Ranking..."
  // forever under `npm run dev`, exactly where chapter/motion work happens. Setting it inside the effect
  // body (not just the initializer) makes it correct across StrictMode's extra mount/unmount cycle.
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  if (!network) return null
  const preset = PRESETS.find((p) => p.id === presetId)!

  const compare = async () => {
    setStatus('loading'); setError(undefined); setRanking(undefined); setChosen(0)
    try {
      const r = await getClient().rank(network, preset.down, {}, candidates)
      if (!mounted.current) return
      setRanking(r); setStatus('idle')
    } catch (e) {
      if (!mounted.current) return
      // superseded by a later compare() call. Not currently reachable through the shipped UI (select and
      // Compare both disable during loading, confirmed by the independent review: instrumented
      // postMessage, always exactly 1 call per Compare click) -- kept as defensive handling for a future
      // UI change that allows re-triggering mid-rank, not dead code removal bait.
      if (e instanceof SupersededError) return
      setStatus('error'); setError(e instanceof Error ? e.message : String(e))
    }
  }

  const shown = ranking ? [...new Set([...ranking.slice(0, TOP_SHOWN).map((_, i) => i), chosen])].sort((a, b) => a - b) : []
  const best = ranking?.[0]
  const sel = ranking?.[chosen]

  return (
    <section aria-labelledby="cr-h">
      <h2 id="cr-h">Compare restoration</h2>
      <p>Hypothetical fault scenarios (synthetic, chosen for this control; not tied to the app&apos;s current scenario above). Ranks every restoration order by served_mw_steps (sum of served MW over the intermediate restoration states, one equal time step per action -- MW&middot;steps, not MWh).</p>
      <label>Fault scenario{' '}
        <select value={presetId} disabled={status === 'loading'} onChange={(e) => { setPresetId(e.target.value); setRanking(undefined) }}>
          {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </label>{' '}
      <button disabled={status === 'loading'} onClick={() => void compare()}>Compare</button>
      {status === 'loading' && <p role="status">Ranking {factorial(preset.down.length)} orders in Worker...</p>}
      {status === 'error' && <p role="alert">Rank failed: {error}</p>}
      {ranking && best && sel && (
        <>
          <p role="status" aria-live="polite">
            <span data-testid="cr-n-orders">{ranking.length}</span> orders ranked. Best: rank {best.rank}, order [{best.order.join(', ')}], <span data-testid="cr-best-served">{best.served_mw_steps.toFixed(2)}</span> MW&middot;steps.
          </p>
          <ul>
            {shown.map((i) => {
              const r = ranking[i]
              return (
                <li key={i}>
                  <button aria-pressed={i === chosen} onClick={() => setChosen(i)}>
                    rank {r.rank}: order [{r.order.join(', ')}], {r.served_mw_steps.toFixed(2)} MW&middot;steps
                  </button>
                </li>
              )
            })}
          </ul>
          <div role="group" aria-label="Chosen order detail">
            <p>Chosen: rank <span data-testid="cr-chosen-rank">{sel.rank}</span> of {ranking.length}, order [{sel.order.join(', ')}] -- <span data-testid="cr-chosen-served">{sel.served_mw_steps.toFixed(2)}</span> MW&middot;steps
              {sel !== best && <> ({(best.served_mw_steps - sel.served_mw_steps).toFixed(2)} MW&middot;steps behind best)</>}</p>
            <ol>
              {sel.steps.map((s) => (
                <li key={s.step}>step {s.step}{s.restored.length ? ` (restored #${s.restored[0]})` : ' (nothing restored yet)'}: {s.status === 'infeasible' ? 'n/a (infeasible)' : `${s.served_mw.toFixed(2)} MW served`}</li>
              ))}
            </ol>
          </div>
        </>
      )}
      {/* deliberately NOT className="provenance" -- that class is the shared scenario's own label
          elsewhere in App.tsx; reusing it here would make every `.provenance` locator in the existing
          e2e suite match 2 elements once this control renders, a Playwright strict-mode violation */}
      <p data-testid="cr-provenance">SIMULATED: island-aware DC-OPF oracle output over a HYPOTHETICAL fault scenario (not observed data); comparison animation not yet built (M4 motion pass).</p>
    </section>
  )
}
