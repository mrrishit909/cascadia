// Probes for races / state-loss the D1 fix may not cover. Prints solver-derived state + exact Worker requests.
import { open, selBus, selLine, confirm, removeBus, slider, settle, snap } from './lib.mjs'
const show = (name, s) => console.log(`\n== ${name}\n`, JSON.stringify(s, null, 1))
const which = process.argv[2] ?? 'all'
const run = async (name, delay, fn) => { if (which !== 'all' && which !== name) return; const { b, p } = await open(delay); try { await fn(p) } catch (e) { console.log(name, 'ERROR', e.message) } await b.close() }

// A: allow_shed is not part of the pending/confirmed scenario; removeBus never sends it.
await run('A_allowshed_dropped', 0, async p => {
  await selLine(p, 9)
  await p.getByRole('checkbox').focus(); await p.keyboard.press('Space') // shedding OFF
  await settle(p)
  await slider(p, 'PageDown') // try a big step
  await settle(p)
  let s = await snap(p); show('A1 after shed-off + slider PageDown', s)
  // drive slider down to 0.25 by ArrowLeft from current value
  const v = +s.sliderValue; const n = Math.round((v - 0.25) / 0.05); if (n > 0) { await slider(p, 'ArrowLeft', n); await settle(p) }
  s = await snap(p); show('A2 line 9 low capacity, shedding disabled', s)
  await removeBus(p, 2); await settle(p)
  s = await snap(p); show('A3 then remove bus 2 (checkbox still unchecked?)', s)
  await slider(p, 'ArrowRight'); await settle(p); await slider(p, 'ArrowLeft'); await settle(p)
  s = await snap(p); show('A4 same scenario re-solved via slider (nudge right then back left)', s)
})

// C: slider resync on line re-select reads CONFIRMED lineCapacity, ignoring pending.
await run('C_slider_resync_pending', 1500, async p => {
  await selLine(p, 9); await slider(p, 'ArrowLeft'); await p.waitForTimeout(350) // debounce elapsed, solve in flight (WASM delayed)
  await selLine(p, 10); await selLine(p, 9)
  const during = await snap(p)
  await settle(p, 8000)
  const s = await snap(p); show('C after line9 0.95 in flight, switch to 10 and back to 9 (during)', { capFactor: during.capFactor, solving: during.solving }); show('C settled', s)
})

// D: slider change then switching line inside the 250ms debounce window.
await run('D_line_switch_in_debounce', 0, async p => {
  await selLine(p, 9); await slider(p, 'ArrowLeft'); await selLine(p, 10)
  await settle(p); show('D line9 ArrowLeft then immediately select line 10', await snap(p))
})

// E: 3+ actions across both controls and two lines while the first solve is in flight.
await run('E_multi_action', 1500, async p => {
  await removeBus(p, 26)
  await selLine(p, 9); await slider(p, 'ArrowLeft'); await p.waitForTimeout(300)
  await selLine(p, 10); await slider(p, 'ArrowRight'); await p.waitForTimeout(300)
  await selLine(p, 9); await slider(p, 'ArrowLeft', 2)
  await settle(p, 8000); show('E remove26, L9 0.95, L10 1.05, L9 -> ? (expect 26 removed, L10 rating 68.25)', await snap(p))
})

// B: Reset while a capacity change is still inside its debounce window (result still === baseline).
await run('B_reset_in_debounce', 1500, async p => {
  await removeBus(p, 26) // pending, result still === baseline (WASM delayed)
  await selLine(p, 9); await slider(p, 'ArrowLeft')
  await p.getByRole('button', { name: 'Reset to baseline' }).focus(); await p.keyboard.press('Enter')
  await p.waitForTimeout(3500); await settle(p, 6000)
  show('B remove26 (pending) + L9 ArrowLeft then Reset inside debounce (expect baseline)', await snap(p))
})

// G1: reset during in-flight removal, then immediately a different removal.
await run('G1_reset_then_new_action', 1500, async p => {
  await removeBus(p, 26); await p.waitForTimeout(50)
  await p.getByRole('button', { name: 'Reset to baseline' }).focus(); await p.keyboard.press('Enter')
  const rb = await p.getByRole('button', { name: 'Reset to baseline' }).isDisabled()
  await removeBus(p, 5)
  await settle(p, 8000); const s = await snap(p)
  const b5 = await p.locator('[data-bus="5"]').getAttribute('data-state')
  show(`G1 remove26, reset (reset now disabled=${rb}), remove5 immediately -> bus5=${b5} (expect bus5 removed, bus26 served)`, s)
})
// G2: reset during in-flight removal, then a capacity change; stale removal must not reappear.
await run('G2_reset_then_capacity', 1500, async p => {
  await removeBus(p, 26)
  await p.getByRole('button', { name: 'Reset to baseline' }).focus(); await p.keyboard.press('Enter')
  await selLine(p, 9); await slider(p, 'ArrowLeft')
  await settle(p, 8000); show('G2 remove26, reset, L9 0.95 (expect bus26 served, line9 30.4, unserved 0)', await snap(p))
})
// G3: two pending removals across a reset: remove26 (in flight), reset, remove 5, reset again, then stale results land.
await run('G3_double_reset', 1500, async p => {
  await removeBus(p, 26)
  await p.getByRole('button', { name: 'Reset to baseline' }).focus(); await p.keyboard.press('Enter')
  await removeBus(p, 5)
  await p.getByRole('button', { name: 'Reset to baseline' }).focus(); await p.keyboard.press('Enter')
  await p.waitForTimeout(4000); await settle(p)
  const b5 = await p.locator('[data-bus="5"]').getAttribute('data-state')
  show(`G3 remove26, reset, remove5, reset -> bus5=${b5} (expect all baseline)`, await snap(p))
})
