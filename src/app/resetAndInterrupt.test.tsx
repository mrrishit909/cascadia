// Acceptance: "Exact reset" (deep-equal full AppState) and "Interruption safety" (latest request wins).
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import highsLoader from 'highs'
import { afterEach, expect, it, vi } from 'vitest'
import { solveDcopf } from '../engine/dcopf'
import { createLpClient, type WorkerLike } from '../workers/lpClient'
import type { LpRequest } from '../workers/lpWorker'
import { Scene } from './App'
import { AppProvider, useApp, type AppState } from './state'
import { homeControl } from './testHelpers'

const files = import.meta.glob('/public/data/**/*.json', { import: 'default' }) as Record<string, () => Promise<unknown>>
afterEach(() => vi.unstubAllGlobals())
const stubFetch = () => vi.stubGlobal('fetch', async (url: string) => ({
  ok: true, json: async () => (await files[`/public${url.slice(url.indexOf('/data/'))}`]()),
}))

// epoch is internal bookkeeping (see AppState's comment in state.tsx) that legitimately changes on every
// reset by design (that's how a stale in-flight solve is told to discard itself) -- it isn't part of the
// user-visible "scenario state" that an exact reset promises to restore, so exclude it from equality checks.
const sansEpoch = (s: AppState) => { const { epoch: _epoch, ...rest } = s; return rest }

async function setup(solver: Parameters<typeof AppProvider>[0]['solver']) {
  stubFetch()
  const h: { state: AppState; api: ReturnType<typeof useApp> } = {} as never
  const Probe = () => { h.api = useApp(); h.state = h.api.state; return null }
  render(<AppProvider solver={solver}><Probe /><Scene /></AppProvider>)
  await screen.findAllByTestId('bus')
  return h
}

it('CAS-INT-001: reset after bus removal deep-equals the post-load state', async () => {
  const highs = await highsLoader()
  const h = await setup(async (c, sc) => solveDcopf(c, highs, sc))
  const before = structuredClone(h.state)
  const bus = screen.getAllByTestId('bus')[26]
  bus.focus(); fireEvent.keyDown(bus, { key: 'Enter' })
  fireEvent.click(within(homeControl('Remove substation')).getByText('Confirm removal'))
  await waitFor(() => expect(h.state.removedBus).toBe(26))
  expect(h.state).not.toEqual(before)
  fireEvent.click(screen.getByText('Reset to baseline'))
  expect(sansEpoch(h.state)).toEqual(sansEpoch(before))
  expect(h.state.epoch).toBe(before.epoch + 1) // reset bumps epoch -- see state.tsx
})

it('CAS-INT-005: reset after capacity change deep-equals the post-load state', async () => {
  const highs = await highsLoader()
  const h = await setup(async (c, sc) => solveDcopf(c, highs, sc))
  const before = structuredClone(h.state)
  const line = screen.getAllByTestId('line')[9]
  line.focus(); fireEvent.keyDown(line, { key: 'Enter' })
  fireEvent.change(within(homeControl('Alter line capacity')).getByRole('slider'), { target: { value: '0.5' } })
  await waitFor(() => expect(h.state.lineCapacity).toEqual({ 9: 0.5 }), { timeout: 3000 })
  expect(h.state).not.toEqual(before)
  fireEvent.click(screen.getByText('Reset to baseline'))
  expect(sansEpoch(h.state)).toEqual(sansEpoch(before))
  expect(h.state.epoch).toBe(before.epoch + 1)
})

it('interruption: bus A then bus B; A reply arrives last yet only B is stored/displayed', async () => {
  const highs = await highsLoader()
  const held: (() => void)[] = []
  const worker: WorkerLike = {
    onmessage: null,
    postMessage(m: LpRequest) {
      if (m.kind === 'rank') throw new Error('unexpected rank request in this test')
      const result = solveDcopf(m.case, highs, m.scenario)
      held.push(() => worker.onmessage?.({ data: { id: m.id, ok: true, result } }))
    },
  }
  const client = createLpClient(worker)
  const h = await setup((c, sc) => client.solve(c, sc))
  let a!: Promise<void>, b!: Promise<void>
  act(() => { a = h.api.removeBus(26) })
  act(() => { b = h.api.removeBus(5) }) // same stale closure is fine: both read the loaded network
  expect(held).toHaveLength(2)
  await act(async () => { held[1](); await b }) // B resolves first
  expect(h.state.removedBus).toBe(5)
  const afterB = structuredClone(h.state)
  await act(async () => { held[0](); await a }) // stale A reply arrives late
  expect(h.state).toEqual(afterB)
  expect(h.state.result?.id).toBe('bus_removal_5')
  expect(h.state.solve).toBe('idle')
})

it('interruption: A reply arriving before B is submitted-complete is dropped, no error state', async () => {
  const highs = await highsLoader()
  const held: (() => void)[] = []
  const worker: WorkerLike = {
    onmessage: null,
    postMessage(m: LpRequest) {
      if (m.kind === 'rank') throw new Error('unexpected rank request in this test')
      const result = solveDcopf(m.case, highs, m.scenario)
      held.push(() => worker.onmessage?.({ data: { id: m.id, ok: true, result } }))
    },
  }
  const client = createLpClient(worker)
  const h = await setup((c, sc) => client.solve(c, sc))
  let a!: Promise<void>, b!: Promise<void>
  act(() => { a = h.api.removeBus(26) })
  act(() => { b = h.api.removeBus(5) })
  await act(async () => { held[0](); await a }) // A first (in order), already superseded
  expect(h.state.removedBus).toBeNull()
  expect(h.state.solve).toBe('solving')
  expect(h.state.solveError).toBeUndefined()
  await act(async () => { held[1](); await b })
  expect(h.state.result?.id).toBe('bus_removal_5')
  expect(h.state.removedBus).toBe(5)
})
