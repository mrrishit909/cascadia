import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import highsLoader from 'highs'
import { readFileSync } from 'node:fs'
import { solveDcopf, type ScenarioParams } from '../engine/dcopf'
import { AppProvider, useApp, type AppState } from './state'
import { Scene } from './App'
import type { Case30 } from '../engine/types'

const files = import.meta.glob('/public/data/**/*.json', { import: 'default' }) as Record<string, () => Promise<unknown>>
afterEach(() => vi.unstubAllGlobals())

async function setup() {
  vi.stubGlobal('fetch', async (url: string) => ({ ok: true, json: async () => await files[`/public${url.slice(url.indexOf('/data/'))}`]() }))
  const highs = await highsLoader()
  const net = (await files['/public/data/raw-metadata/case30.json']()) as Case30
  let snap!: AppState
  let api!: ReturnType<typeof useApp>
  const Probe = () => { api = useApp(); snap = api.state; return null }
  render(<AppProvider solver={async (c, sc) => solveDcopf(c, highs, sc)}><Probe /><Scene /></AppProvider>)
  await screen.findAllByTestId('bus')
  return { net, highs, get snap() { return snap }, get api() { return api } }
}
const sweep = (id: string) => JSON.parse(readFileSync('verification/REFERENCE_RESULTS/n1_sweep.json', 'utf8')).cases.find((c: { case_id: string }) => c.case_id === id)
const sel = (name: RegExp, v: string) => fireEvent.change(within(screen.getAllByRole('combobox').map(c => c.closest('section')!).find(sec => within(sec).queryByLabelText(name))!).getByLabelText(name), { target: { value: v } })

// CAS-INT-007: oracle case line_outage_33 (shed 3.5 MW, 2 islands) and line_outage_15 (binding 29).
it('line outage 33 matches oracle shed + islands, keyboard-confirmable, Escape cancels, reset restores', async () => {
  const t = await setup()
  const baseline = t.snap.result
  const ref = sweep('line_outage_33')
  sel(/^Line to disable/, '33')
  fireEvent.click(screen.getByText('Disable line'))
  fireEvent.keyDown(screen.getByRole('group', { name: 'Confirm outage' }), { key: 'Escape' })
  expect(screen.queryByRole('group', { name: 'Confirm outage' })).toBeNull()
  fireEvent.click(screen.getByText('Disable line'))
  fireEvent.click(screen.getByText('Confirm outage'))
  await waitFor(() => expect(screen.getByTestId('outage-unserved')).toHaveTextContent(`${ref.total_shed.toFixed(2)} MW`))
  expect(screen.getByTestId('outage-islands')).toHaveTextContent(String(ref.n_islands))
  expect(screen.getByTestId('outage-list')).toHaveTextContent('33')
  expect(t.snap.disabledLines).toEqual([33])
  expect(screen.getAllByTestId('line')[33]).not.toHaveAttribute('data-binding') // dead line drawn out of topology
  fireEvent.click(screen.getByText('Reset to baseline'))
  expect(t.snap.result).toBe(baseline)
  expect(t.snap.disabledLines).toEqual([])
})

it('line outage 15 shows oracle binding line 29', async () => {
  const t = await setup()
  const ref = sweep('line_outage_15')
  sel(/^Line to disable/, '15'); fireEvent.click(screen.getByText('Disable line')); fireEvent.click(screen.getByText('Confirm outage'))
  await waitFor(() => expect(t.snap.result?.id).toBe('line_outage_15'))
  expect(t.snap.result!.result.binding_lines).toEqual(ref.binding_lines)
  expect(screen.getAllByTestId('line')[29]).toHaveAttribute('data-binding', 'binding')
})

// CAS-INT-002: no oracle sweep case exists for load_scale; compare against an independent engine solve.
it('increasing load at bus 7 solves with load_scale and reset clears it', async () => {
  const t = await setup()
  const baseline = t.snap.result
  sel(/Load bus/, '7')
  fireEvent.change(screen.getByLabelText(/Load multiplier/), { target: { value: '5' } })
  fireEvent.click(screen.getByText('Apply load'))
  const want = solveDcopf(t.net, t.highs, { load_scale: { 7: 5 } })
  await waitFor(() => expect(t.snap.loadScale).toEqual({ 7: 5 }))
  expect(screen.getByTestId('load-unserved')).toHaveTextContent(`${want.total_unserved_mw.toFixed(2)} MW`)
  expect(t.snap.result!.result.flows).toEqual(want.flows)
  fireEvent.click(screen.getByText('Reset to baseline'))
  expect(t.snap.result).toBe(baseline)
  expect(t.snap.loadScale).toEqual({})
})

// CAS-INT-003
it('reducing generator 0 to 0 MW matches engine solve and shows shed markers when capacity is short', async () => {
  const t = await setup()
  const baseline = t.snap.result
  sel(/^Generator$/, '0')
  fireEvent.change(screen.getByLabelText(/^Pmax/), { target: { value: '0' } })
  fireEvent.click(screen.getByText('Apply limit'))
  const want = solveDcopf(t.net, t.highs, { gen_pmax_mw: { 0: 0 } })
  await waitFor(() => expect(t.snap.genPmax).toEqual({ 0: 0 }))
  expect(t.snap.result!.result.gen['0'] ?? 0).toBe(0)
  expect(screen.getByTestId('gen-unserved')).toHaveTextContent(`${want.total_unserved_mw.toFixed(2)} MW`)
  fireEvent.click(screen.getByText('Reset to baseline'))
  expect(t.snap.result).toBe(baseline)
  expect(t.snap.genPmax).toEqual({})
})

it('severe generator reduction sheds load (markers) once total Pmax < demand', async () => {
  const t = await setup()
  let want!: ScenarioParams
  for (const g of [0, 1, 2, 3, 4]) { sel(/^Generator$/, String(g)); fireEvent.change(screen.getByLabelText(/^Pmax/), { target: { value: '0' } }); fireEvent.click(screen.getByText('Apply limit')); await waitFor(() => expect(t.snap.genPmax[g]).toBe(0)) }
  want = { gen_pmax_mw: { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 } }
  const r = solveDcopf(t.net, t.highs, want)
  expect(r.total_unserved_mw).toBeGreaterThan(0)
  expect(screen.getByTestId('gen-unserved')).toHaveTextContent(`${r.total_unserved_mw.toFixed(2)} MW`)
  expect(screen.getByTestId('gen-shed')).not.toHaveTextContent('none')
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
