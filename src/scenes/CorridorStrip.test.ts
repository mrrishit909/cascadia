import { describe, expect, it } from 'vitest'
import { computeBaselineRails, RAIL_COUNT } from './CorridorStrip'
import type { Case30, SolveResult } from '../engine/types'

function net(lines: Partial<Case30['lines'][number]>[]): Case30 {
  return {
    sn_mva: 100, buses: [], gens: [], loads: [],
    lines: lines.map((l, idx) => ({ idx, from_bus: 0, to_bus: 1, r_ohm: 0, x_ohm: 0, max_i_ka: 1, x_pu: 0.1, rating_mw: 100, ...l })),
  }
}
function result(flows: Record<string, number>, ratings: Record<string, number> = {}): SolveResult {
  return { status: 'optimal', flows, line_rating_mw: ratings, gen: {}, shed: {}, islands: [], binding_lines: [], diagnostics: [], total_load_mw: 0, total_unserved_mw: 0, objective: 0 }
}

describe('computeBaselineRails (ART_DIRECTION.md section 3: the 4 most-loaded lines by |flow|/rating)', () => {
  it('picks the top 4 by utilization ratio, highest first', () => {
    const network = net([{ rating_mw: 100 }, { rating_mw: 100 }, { rating_mw: 100 }, { rating_mw: 100 }, { rating_mw: 100 }])
    const r = result({ '0': 10, '1': 90, '2': 50, '3': 30, '4': 70 })
    expect(computeBaselineRails(network, r)).toEqual([1, 4, 2, 3])
    expect(computeBaselineRails(network, r)).toHaveLength(RAIL_COUNT)
  })

  it('uses the per-line rating, not a uniform assumption', () => {
    const network = net([{ rating_mw: 10 }, { rating_mw: 1000 }])
    const r = result({ '0': 5, '1': 5 }) // line 0: 50% of its own rating; line 1: 0.5% -- line 0 must rank first
    expect(computeBaselineRails(network, r)[0]).toBe(0)
  })

  it('uses result.line_rating_mw when present, overriding the static network rating', () => {
    const network = net([{ rating_mw: 100 }, { rating_mw: 100 }])
    const r = result({ '0': 50, '1': 50 }, { '0': 50 }) // line 0's EFFECTIVE rating is 50 (100% utilized), line 1 stays at 50% (its static 100)
    expect(computeBaselineRails(network, r)[0]).toBe(0)
  })

  it('takes the absolute value of flow (direction never affects ranking)', () => {
    const network = net([{ rating_mw: 100 }, { rating_mw: 100 }])
    const r = result({ '0': -90, '1': 10 })
    expect(computeBaselineRails(network, r)[0]).toBe(0)
  })
})
