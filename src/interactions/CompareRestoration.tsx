import { useId } from 'react'
import { useApp } from '../app/state'
import type { DownElement } from '../engine/dcopf'

// CAS-INT-006. Presets mirror research/evaluate/add_line_restoration.py's RESTORE dict exactly (pinned
// by e2e/compareRestoration.spec.ts against verification/REFERENCE_RESULTS/add_line_restoration.json).
// Exported for Chapter5Comparison.tsx: it needs each preset's own `down` set to know which elements
// are still "down" at a given restoration step (CAS-INT-006's own `order`/`steps[].restored` are
// indices into THIS array, not raw bus/line ids) -- the single source of truth, never duplicated.
export const PRESETS: { id: string; label: string; down: DownElement[] }[] = [
  { id: 'island_pocket_plus_line9', label: 'Island pocket + line 9 (3 down)', down: [{ kind: 'line', id: 36 }, { kind: 'line', id: 37 }, { kind: 'line', id: 9 }] },
  { id: 'bus_and_lines', label: 'Bus 26 + two lines (3 down)', down: [{ kind: 'bus', id: 26 }, { kind: 'line', id: 34 }, { kind: 'line', id: 9 }] },
  { id: 'two_buses', label: 'Two buses (2 down)', down: [{ kind: 'bus', id: 11 }, { kind: 'bus', id: 26 }] },
  { id: 'k5_mixed', label: 'Mixed k=5 (5 down, 120 orders)', down: [{ kind: 'line', id: 36 }, { kind: 'line', id: 37 }, { kind: 'line', id: 9 }, { kind: 'bus', id: 11 }, { kind: 'line', id: 3 }] },
]
const TOP_SHOWN = 5
const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1))

// Architecture-stabilization pass: this control is designed to mount TWICE (its home chapter 5 and
// chapter 6's laboratory, per docs/ART_DIRECTION.md's chapter table). All its state (preset, status,
// ranking, chosen order) now lives in shared AppState.restoration, and the Worker/client live in
// AppProvider (see state.tsx's restorationSolver/compareRestoration) -- so both mounted instances
// always show the identical result, and only ONE Worker/WASM load exists regardless of mount count.
// useId() keeps each instance's own heading id unique when both are mounted simultaneously.
export function CompareRestoration({ placement }: { placement: 'home' | 'lab' }) {
  const { state, selectRestorationPreset, compareRestoration, chooseRestoration } = useApp()
  const { network, restoration } = state
  const headingId = useId()
  const presetId = restoration.presetId || PRESETS[0].id
  if (!network) return null
  const preset = PRESETS.find((p) => p.id === presetId)!
  const { status, error, ranking, chosen } = restoration

  const shown = ranking ? [...new Set([...ranking.slice(0, TOP_SHOWN).map((_, i) => i), chosen])].sort((a, b) => a - b) : []
  const best = ranking?.[0]
  const sel = ranking?.[chosen]

  return (
    <section data-placement={placement} aria-labelledby={headingId}>
      <h2 id={headingId}>Compare restoration{placement === 'lab' && <span className="sr-only"> (laboratory)</span>}</h2>
      <p>Hypothetical fault scenarios (synthetic, chosen for this control; not tied to the app&apos;s current scenario above). Ranks every restoration order by served_mw_steps (sum of served MW over the intermediate restoration states, one equal time step per action -- MW&middot;steps, not MWh).</p>
      <label>Fault scenario{' '}
        <select value={presetId} disabled={status === 'loading'} onChange={(e) => selectRestorationPreset(e.target.value)}>
          {PRESETS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </label>{' '}
      <button disabled={status === 'loading'} onClick={() => void compareRestoration(preset.down)}>Compare</button>
      {/* Architecture-stabilization fix: these were role="status"/role="alert" (each an independent
          live region). A single mounted instance was already fine; dual-mounting (chapter 5 + lab,
          per docs/ART_DIRECTION.md) would have doubled the announcement. The shared
          <RestorationStatusRegion/> (App.tsx) is now the only live-announcing element for this
          subsystem; these stay plain text, visually identical, silent to AT. */}
      {status === 'loading' && <p>Ranking {factorial(preset.down.length)} orders in Worker...</p>}
      {status === 'error' && <p>Rank failed: {error}</p>}
      {ranking && best && sel && (
        <>
          <p>
            <span data-testid="cr-n-orders">{ranking.length}</span> orders ranked. Best: rank {best.rank}, order [{best.order.join(', ')}], <span data-testid="cr-best-served">{best.served_mw_steps.toFixed(2)}</span> MW&middot;steps.
          </p>
          <ul>
            {shown.map((i) => {
              const r = ranking[i]
              return (
                <li key={i}>
                  <button aria-pressed={i === chosen} onClick={() => chooseRestoration(i)}>
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
