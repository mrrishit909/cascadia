import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import highsLoader from 'highs'
import { readFileSync } from 'node:fs'
import { solveDcopf, type ScenarioParams } from '../engine/dcopf'
import { AppProvider, useApp, type AppState } from './state'
import { Scene } from './App'
import { homeControl } from './testHelpers'
import { activateChapter } from '../test-setup'
import type { Case30 } from '../engine/types'

const files = import.meta.glob('/public/data/**/*.json', { import: 'default' }) as Record<string, () => Promise<unknown>>
afterEach(() => vi.unstubAllGlobals())

// `chapter`: jsdom has no real scroll/intersection geometry (test-setup.ts's mock), so a test that
// asserts on the SHARED STAGE's own bus/line attributes (not just a control's own readout, which always
// shows live truth regardless of active chapter) must explicitly activate that control's home chapter
// first -- a real browser user actually scrolled there sees exactly what these tests then check.
async function setup(chapter?: string) {
  vi.stubGlobal('fetch', async (url: string) => ({ ok: true, json: async () => await files[`/public${url.slice(url.indexOf('/data/'))}`]() }))
  const highs = await highsLoader()
  const net = (await files['/public/data/raw-metadata/case30.json']()) as Case30
  let snap!: AppState
  let api!: ReturnType<typeof useApp>
  const Probe = () => { api = useApp(); snap = api.state; return null }
  render(<AppProvider solver={async (c, sc) => solveDcopf(c, highs, sc)}><Probe /><Scene /></AppProvider>)
  await screen.findAllByTestId('bus')
  if (chapter) act(() => activateChapter(chapter))
  return { net, highs, get snap() { return snap }, get api() { return api } }
}
const sweep = (id: string) => JSON.parse(readFileSync('verification/REFERENCE_RESULTS/n1_sweep.json', 'utf8')).cases.find((c: { case_id: string }) => c.case_id === id)
// Chapter shell: each control's home placement now lives inside its own chapter <section>, not a
// shared wrapper div. `ctrl(label)` scopes queries to the one home-placement control section matching
// that text (mirrors e2e's controlHome(page, label)); `sel(label, name, v)` additionally finds the
// <select> with the given accessible name inside it.
const ctrl = (label: string) => within(homeControl(label))
const sel = (label: string, name: RegExp, v: string) => fireEvent.change(ctrl(label).getByLabelText(name), { target: { value: v } })

// CAS-INT-007: oracle case line_outage_33 (shed 3.5 MW, 2 islands) and line_outage_15 (binding 29).
it('line outage 33 matches oracle shed + islands, keyboard-confirmable, Escape cancels, reset restores', async () => {
  const t = await setup('ch4')
  const baseline = t.snap.result
  const ref = sweep('line_outage_33')
  sel('Line outage', /^Line to disable/, '33')
  fireEvent.click(ctrl('Line outage').getByText('Disable line'))
  fireEvent.keyDown(ctrl('Line outage').getByRole('group', { name: 'Confirm outage' }), { key: 'Escape' })
  expect(ctrl('Line outage').queryByRole('group', { name: 'Confirm outage' })).toBeNull()
  fireEvent.click(ctrl('Line outage').getByText('Disable line'))
  fireEvent.click(ctrl('Line outage').getByText('Confirm outage'))
  await waitFor(() => expect(ctrl('Line outage').getByTestId('outage-unserved')).toHaveTextContent(`${ref.total_shed.toFixed(2)} MW`))
  expect(ctrl('Line outage').getByTestId('outage-islands')).toHaveTextContent(String(ref.n_islands))
  expect(ctrl('Line outage').getByTestId('outage-list')).toHaveTextContent('33')
  expect(t.snap.disabledLines).toEqual([33])
  expect(screen.getAllByTestId('line')[33]).not.toHaveAttribute('data-binding') // dead line drawn out of topology
  fireEvent.click(screen.getByText('Reset to baseline'))
  expect(t.snap.result).toBe(baseline)
  expect(t.snap.disabledLines).toEqual([])
})

it('line outage 15 shows oracle binding line 29', async () => {
  const t = await setup('ch4')
  const ref = sweep('line_outage_15')
  sel('Line outage', /^Line to disable/, '15'); fireEvent.click(ctrl('Line outage').getByText('Disable line')); fireEvent.click(ctrl('Line outage').getByText('Confirm outage'))
  await waitFor(() => expect(t.snap.result?.id).toBe('line_outage_15'))
  expect(t.snap.result!.result.binding_lines).toEqual(ref.binding_lines)
  expect(screen.getAllByTestId('line')[29]).toHaveAttribute('data-binding', 'binding')
})

// CAS-INT-002: no oracle sweep case exists for load_scale; compare against an independent engine solve.
it('increasing load at bus 7 solves with load_scale and reset clears it', async () => {
  const t = await setup()
  const baseline = t.snap.result
  sel('Increase load', /Load bus/, '7')
  fireEvent.change(ctrl('Increase load').getByLabelText(/Load multiplier/), { target: { value: '5' } })
  fireEvent.click(ctrl('Increase load').getByText('Apply load'))
  const want = solveDcopf(t.net, t.highs, { load_scale: { 7: 5 } })
  await waitFor(() => expect(t.snap.loadScale).toEqual({ 7: 5 }))
  expect(ctrl('Increase load').getByTestId('load-unserved')).toHaveTextContent(`${want.total_unserved_mw.toFixed(2)} MW`)
  expect(t.snap.result!.result.flows).toEqual(want.flows)
  fireEvent.click(screen.getByText('Reset to baseline'))
  expect(t.snap.result).toBe(baseline)
  expect(t.snap.loadScale).toEqual({})
})

// CAS-INT-003
it('reducing generator 0 to 0 MW matches engine solve and shows shed markers when capacity is short', async () => {
  const t = await setup()
  const baseline = t.snap.result
  sel('Reduce generator', /^Generator$/, '0')
  fireEvent.change(ctrl('Reduce generator').getByLabelText(/^Pmax/), { target: { value: '0' } })
  fireEvent.click(ctrl('Reduce generator').getByText('Apply limit'))
  const want = solveDcopf(t.net, t.highs, { gen_pmax_mw: { 0: 0 } })
  await waitFor(() => expect(t.snap.genPmax).toEqual({ 0: 0 }))
  expect(t.snap.result!.result.gen['0'] ?? 0).toBe(0)
  expect(ctrl('Reduce generator').getByTestId('gen-unserved')).toHaveTextContent(`${want.total_unserved_mw.toFixed(2)} MW`)
  fireEvent.click(screen.getByText('Reset to baseline'))
  expect(t.snap.result).toBe(baseline)
  expect(t.snap.genPmax).toEqual({})
})

it('severe generator reduction sheds load (markers) once total Pmax < demand', async () => {
  const t = await setup()
  let want!: ScenarioParams
  for (const g of [0, 1, 2, 3, 4]) { sel('Reduce generator', /^Generator$/, String(g)); fireEvent.change(ctrl('Reduce generator').getByLabelText(/^Pmax/), { target: { value: '0' } }); fireEvent.click(ctrl('Reduce generator').getByText('Apply limit')); await waitFor(() => expect(t.snap.genPmax[g]).toBe(0)) }
  want = { gen_pmax_mw: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 } }
  const r = solveDcopf(t.net, t.highs, want)
  expect(r.total_unserved_mw).toBeGreaterThan(0)
  expect(ctrl('Reduce generator').getByTestId('gen-unserved')).toHaveTextContent(`${r.total_unserved_mw.toFixed(2)} MW`)
  expect(ctrl('Reduce generator').getByTestId('gen-shed')).not.toHaveTextContent('none')
})

// D1/N1 bug class: three actions fired back-to-back, before any solve resolves, must all survive.
it('chained load + generator + outage actions (no awaiting) all land in the final scenario', async () => {
  const t = await setup()
  void t.api.setLoadScale(7, 2)
  void t.api.setGenPmax(1, 40)
  void t.api.setLineOutage(15, true)
  await waitFor(() => expect(t.snap.solve).toBe('idle'))
  await waitFor(() => expect(t.snap.disabledLines).toEqual([15]))
  expect(t.snap.loadScale).toEqual({ 7: 2 })
  expect(t.snap.genPmax).toEqual({ 1: 40 })
  const want = solveDcopf(t.net, t.highs, { load_scale: { 7: 2 }, gen_pmax_mw: { 1: 40 }, disabled_lines: [15] })
  expect(t.snap.result!.result.total_unserved_mw).toBeCloseTo(want.total_unserved_mw, 6)
  expect(t.snap.result!.result.flows).toEqual(want.flows)
})
