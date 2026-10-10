import { act, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import App from './App'
import { homeControl } from './testHelpers'
import { activateChapter } from '../test-setup'

// Chapter shell: every control's home placement now lives inside its own chapter <section>, not a
// single wrapper div -- so testids/roles that live inside a control (not the NetworkView stage, not
// app-level singletons like Reset/StatusRegion) are no longer unique across the whole document.
// `homeControl(label)` scopes queries to the one home-placement control section matching that text,
// mirroring e2e's controlHome(page, label).

const files = import.meta.glob('/public/data/**/*.json', { import: 'default' }) as Record<string, () => Promise<unknown>>

afterEach(() => vi.unstubAllGlobals())

// Dual-placement gate (advisor review): with LabStub now permanently mounting a real second placement
// of all 7 controls, every [id] in the document must stay unique -- useId() (architecture-stabilization
// pass) is what's supposed to guarantee this; this is the first test that checks it against the REAL
// App, not just a synthetic double-mount of one component in isolation (dualMount.test.tsx).
it('every [id] on the real App is unique with both home and lab placements mounted', async () => {
  vi.stubGlobal('fetch', async (url: string) => {
    const mod = await files[`/public${url.slice(url.indexOf('/data/'))}`]()
    return { ok: true, json: async () => mod }
  })
  render(<App />)
  await screen.findAllByTestId('bus')
  const ids = Array.from(document.querySelectorAll('[id]')).map(e => e.id)
  expect(ids.length).toBeGreaterThan(0)
  expect(new Set(ids).size).toBe(ids.length)
})

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
  // jsdom has no real scroll/intersection geometry (see test-setup.ts's mock) -- this test asserts on
  // the SHARED STAGE's own bus data-state, which only shows this control's live result while chapter 4
  // (RemoveNode's home chapter) is the active one; a real browser user actually scrolled there sees
  // exactly this. Chapters 1/intro/5 would legitimately keep showing the baseline story regardless of
  // this action, by design (CHAPTER_ARCHITECTURE.md section 3) -- this is not a workaround for a bug.
  act(() => activateChapter('ch4'))
  const baseline = snap.result, baselineCopy = structuredClone(snap.result)
  const removeNode = () => within(homeControl('Remove substation'))
  expect(removeNode().getByTestId('unserved-mw')).toHaveTextContent('0.00 MW')

  const bus = screen.getAllByTestId('bus')[26]
  bus.focus(); fireEvent.keyDown(bus, { key: 'Enter' }) // keyboard select
  fireEvent.keyDown(removeNode().getByRole('group', { name: 'Confirm removal' }), { key: 'Escape' })
  expect(removeNode().queryByRole('group', { name: 'Confirm removal' })).toBeNull() // Escape cancels
  fireEvent.keyDown(bus, { key: ' ' })
  fireEvent.click(removeNode().getByText('Confirm removal'))
  expect(removeNode().getByText(/Solving island-aware/)).toBeTruthy()
  await waitFor(() => expect(removeNode().getByTestId('unserved-mw')).toHaveTextContent(`${ref.total_shed.toFixed(2)} MW`))
  expect(removeNode().getByTestId('shed-no-generation')).toHaveTextContent(`${ref.shed_no_generation.toFixed(2)} MW`)
  expect(removeNode().getByTestId('shed-economic')).toHaveTextContent('0.00 MW')
  expect(bus).toHaveAttribute('data-state', 'removed')
  expect(screen.getAllByTestId('bus').some(b => b.getAttribute('data-state') === 'shed_no_generation')).toBe(true)

  fireEvent.click(screen.getByText('Reset to baseline'))
  expect(snap.result).toBe(baseline) // same reference
  expect(snap.result).toEqual(baselineCopy)
  expect(snap.removedBus).toBeNull()
  expect(removeNode().getByTestId('unserved-mw')).toHaveTextContent('0.00 MW')
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
  act(() => activateChapter('ch3')) // AlterCapacity's home chapter -- see the matching comment above
  const baseline = snap.result, baselineCopy = structuredClone(snap.result)
  const alterCap = () => within(homeControl('Alter line capacity'))
  expect(alterCap().getByTestId('binding-lines')).toHaveTextContent('none')

  const line = screen.getAllByTestId('line')[9]
  line.focus(); fireEvent.keyDown(line, { key: 'Enter' }) // keyboard select
  fireEvent.change(alterCap().getByRole('slider'), { target: { value: '0.5' } })
  await waitFor(() => expect(alterCap().getByTestId('binding-lines')).toHaveTextContent(ref.binding_lines.join(', ')), { timeout: 3000 })
  expect(alterCap().getByTestId('cap-unserved')).toHaveTextContent(`${ref.total_shed.toFixed(2)} MW`)
  for (const i of ref.binding_lines) expect(screen.getAllByTestId('line')[i]).toHaveAttribute('data-binding', 'binding')
  expect(screen.getAllByTestId('line')[0]).toHaveAttribute('data-binding', 'slack')

  fireEvent.click(screen.getByText('Reset to baseline'))
  expect(snap.result).toBe(baseline)
  expect(snap.result).toEqual(baselineCopy)
  expect(snap.lineCapacity).toEqual({})
  expect(alterCap().getByTestId('binding-lines')).toHaveTextContent('none')
  expect(screen.getAllByTestId('line')[9]).toHaveAttribute('data-binding', 'slack')
})
