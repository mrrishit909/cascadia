// @vitest-environment node
import { readFileSync } from 'node:fs'
import highsLoader from 'highs'
import { describe, expect, it } from 'vitest'
import { solveDcopf } from '../engine/dcopf'
import type { Case30, Precomputed } from '../engine/types'
import { createLpClient, SupersededError, type WorkerLike } from './lpClient'
import type { LpRequest } from './lpWorker'

const read = (p: string) => JSON.parse(readFileSync(new URL(`../../public/data/${p}`, import.meta.url), 'utf8'))
const c30: Case30 = read('raw-metadata/case30.json')
const baseline: Precomputed = read('precomputed/baseline.json')
const highs = await highsLoader()

describe('TS DC-OPF vs Python oracle', () => {
  it('baseline objective matches within 1e-3 relative', () => {
    const r = solveDcopf(c30, highs)
    const rel = Math.abs(r.objective - baseline.result.objective) / baseline.result.objective
    console.log(`baseline TS=${r.objective} oracle=${baseline.result.objective} rel=${rel}`)
    expect(rel).toBeLessThan(1e-3)
    expect(r.total_unserved_mw).toBe(0)
  })
})

describe('cancellation', () => {
  it('only the latest request ever resolves', async () => {
    const worker: WorkerLike = {
      onmessage: null,
      postMessage(m: LpRequest) { // fake worker: replies in the same order, asynchronously
        if (m.kind === 'rank') throw new Error('unexpected rank request in this test')
        const result = solveDcopf(m.case, highs, m.scenario)
        setTimeout(() => worker.onmessage?.({ data: { id: m.id, ok: true, result } }), 0)
      },
    }
    const client = createLpClient(worker)
    const first = client.solve(c30, { removed_buses: [26] })
    const second = client.solve(c30)
    await expect(first).rejects.toBeInstanceOf(SupersededError)
    const r = await second
    expect(r.total_unserved_mw).toBe(0) // second (baseline) result, not the bus-26 removal
  })
})
