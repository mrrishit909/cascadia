// Parity tests for the 3 new chapter "story" fixtures (docs/planning/cascadia/CHAPTER_ARCHITECTURE.md
// section 1: scroll-driven chapters show these FIXED, oracle-derived states, never a live solve).
// Mirrors lpWorker.test.ts's existing "TS DC-OPF vs Python oracle" pattern for baseline.json.
// @vitest-environment node
import { readFileSync } from 'node:fs'
import highsLoader from 'highs'
import { describe, expect, it } from 'vitest'
import { solveDcopf, type RestoreSeq } from '../engine/dcopf'
import type { Case30, Precomputed } from '../engine/types'

const read = (p: string) => JSON.parse(readFileSync(new URL(`../../public/data/${p}`, import.meta.url), 'utf8'))
const c30: Case30 = read('raw-metadata/case30.json')
const highs = await highsLoader()

describe('TS DC-OPF vs Python oracle (story fixtures)', () => {
  it('intro_fault_line33 (disabled_lines=[33]) matches within 1e-3 relative', () => {
    const fx: Precomputed = read('precomputed/intro_fault_line33.json')
    const r = solveDcopf(c30, highs, { disabled_lines: [33] })
    const rel = Math.abs(r.objective - fx.result.objective) / fx.result.objective
    expect(rel).toBeLessThan(1e-3)
    expect(r.total_unserved_mw).toBeCloseTo(fx.result.total_unserved_mw, 3)
  })

  it('ch4_fault_bus26 (removed_buses=[26]) matches within 1e-3 relative', () => {
    const fx: Precomputed = read('precomputed/ch4_fault_bus26.json')
    const r = solveDcopf(c30, highs, { removed_buses: [26] })
    const rel = Math.abs(r.objective - fx.result.objective) / fx.result.objective
    expect(rel).toBeLessThan(1e-3)
    expect(r.total_unserved_mw).toBeCloseTo(fx.result.total_unserved_mw, 3)
  })
})

describe('ch5_restoration_island_pocket_plus_line9 fixture shape', () => {
  it('drops directly into AppState.restoration.ranking (RestoreSeq[]) with no transformation', () => {
    const fx = read('precomputed/ch5_restoration_island_pocket_plus_line9.json') as { ranking: RestoreSeq[]; down: unknown[]; n_orders_total: number }
    expect(fx.ranking).toHaveLength(3)
    expect(fx.n_orders_total).toBe(6)
    for (const r of fx.ranking) {
      expect(typeof r.served_mw_steps).toBe('number')
      expect(typeof r.final_served_mw).toBe('number')
      expect(Array.isArray(r.order)).toBe(true)
      expect(r.rank).toBe(1) // 4-way tie at rank 1 in the source reference; see DATA_CONTRACT.yaml CAS-INT-006
      for (const s of r.steps) {
        expect(typeof s.step).toBe('number')
        expect(Array.isArray(s.restored)).toBe(true)
        expect(typeof s.served_mw).toBe('number')
        expect(typeof s.unserved_mw).toBe('number')
        expect(typeof s.status).toBe('string')
      }
    }
  })
})
