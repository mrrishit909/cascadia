import { render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import App from './App'

const files = import.meta.glob('/public/data/**/*.json', { import: 'default' }) as Record<string, () => Promise<unknown>>

afterEach(() => vi.unstubAllGlobals())

it('renders 30 buses and 41 lines from the baseline fixture', async () => {
  vi.stubGlobal('fetch', async (url: string) => {
    const mod = await files[`/public${url.slice(url.indexOf('/data/'))}`]()
    return { ok: true, json: async () => mod }
  })
  render(<App />)
  expect(await screen.findAllByTestId('bus')).toHaveLength(30)
  expect(screen.getAllByTestId('line')).toHaveLength(41)
})

// CAS-INT-001: real HiGHS solve (Node) injected as the Worker; oracle reference = n1_sweep.json bus_removal_26.
import { fireEvent, waitFor } from '@testing-library/react'
import highsLoader from 'highs'
import { readFileSync } from 'node:fs'
import { solveDcopf } from '../engine/dcopf'
import { AppProvider, useApp, type AppState } from './state'
import { Scene } from './App'

it('removing bus 26 shows oracle unserved MW, no-generation shed, and reset restores baseline exactly', async () => {
  vi.stubGlobal('fetch', async (url: string) => {
    const mod = await files[`/public${url.slice(url.indexOf('/data/'))}`]()
    return { ok: true, json: async () => mod }
  })
  const ref = JSON.parse(readFileSync('verification/REFERENCE_RESULTS/n1_sweep.json', 'utf8')).cases
    .find((c: { case_id: string }) => c.case_id === 'bus_removal_26')
  const highs = await highsLoader()
  let snap!: AppState
  const Probe = () => { snap = useApp().state; return null }
  render(<AppProvider solver={async (c, sc) => solveDcopf(c, highs, sc)}><Probe /><Scene /></AppProvider>)
  await screen.findAllByTestId('bus')
  const baseline = snap.result, baselineCopy = structuredClone(snap.result)
  expect(screen.getByTestId('unserved-mw')).toHaveTextContent('0.00 MW')

  const bus = screen.getAllByTestId('bus')[26]
  bus.focus(); fireEvent.keyDown(bus, { key: 'Enter' }) // keyboard select
  fireEvent.keyDown(screen.getByRole('group', { name: 'Confirm removal' }), { key: 'Escape' })
  expect(screen.queryByRole('group', { name: 'Confirm removal' })).toBeNull() // Escape cancels
  fireEvent.keyDown(bus, { key: ' ' })
  fireEvent.click(screen.getByText('Confirm removal'))
  expect(screen.getByText(/Solving island-aware/)).toBeTruthy()
  await waitFor(() => expect(screen.getByTestId('unserved-mw')).toHaveTextContent(`${ref.total_shed.toFixed(2)} MW`))
  expect(screen.getByTestId('shed-no-generation')).toHaveTextContent(`${ref.shed_no_generation.toFixed(2)} MW`)
  expect(screen.getByTestId('shed-economic')).toHaveTextContent('0.00 MW')
  expect(bus).toHaveAttribute('data-state', 'removed')
  expect(screen.getAllByTestId('bus').some(b => b.getAttribute('data-state') === 'shed_no_generation')).toBe(true)

  fireEvent.click(screen.getByText('Reset to baseline'))
  expect(snap.result).toBe(baseline) // same reference
  expect(snap.result).toEqual(baselineCopy)
  expect(snap.removedBus).toBeNull()
  expect(screen.getByTestId('unserved-mw')).toHaveTextContent('0.00 MW')
})

// CAS-INT-005: oracle case line_cap_9_x0.5 (binding [9,28,29], shed 5.2996 MW).
it('line 9 at 0.5x shows oracle binding lines and shed, and reset restores baseline exactly', async () => {
  vi.stubGlobal('fetch', async (url: string) => {
    const mod = await files[`/public${url.slice(url.indexOf('/data/'))}`]()
    return { ok: true, json: async () => mod }
  })
  const ref = JSON.parse(readFileSync('verification/REFERENCE_RESULTS/n1_sweep.json', 'utf8')).cases
    .find((c: { case_id: string }) => c.case_id === 'line_cap_9_x0.5')
  const highs = await highsLoader()
  let snap!: AppState
  const Probe = () => { snap = useApp().state; return null }
  render(<AppProvider solver={async (c, sc) => solveDcopf(c, highs, sc)}><Probe /><Scene /></AppProvider>)
  await screen.findAllByTestId('bus')
  const baseline = snap.result, baselineCopy = structuredClone(snap.result)
  expect(screen.getByTestId('binding-lines')).toHaveTextContent('none')

  const line = screen.getAllByTestId('line')[9]
  line.focus(); fireEvent.keyDown(line, { key: 'Enter' }) // keyboard select
  fireEvent.change(screen.getByRole('slider'), { target: { value: '0.5' } })
  await waitFor(() => expect(screen.getByTestId('binding-lines')).toHaveTextContent(ref.binding_lines.join(', ')), { timeout: 3000 })
  expect(screen.getByTestId('cap-unserved')).toHaveTextContent(`${ref.total_shed.toFixed(2)} MW`)
  for (const i of ref.binding_lines) expect(screen.getAllByTestId('line')[i]).toHaveAttribute('data-binding', 'binding')
  expect(screen.getAllByTestId('line')[0]).toHaveAttribute('data-binding', 'slack')

  fireEvent.click(screen.getByText('Reset to baseline'))
  expect(snap.result).toBe(baseline)
  expect(snap.result).toEqual(baselineCopy)
  expect(snap.lineCapacity).toEqual({})
  expect(screen.getByTestId('binding-lines')).toHaveTextContent('none')
  expect(screen.getAllByTestId('line')[9]).toHaveAttribute('data-binding', 'slack')
})
