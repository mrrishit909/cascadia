// @vitest-environment node
// TS-vs-Python parity for CAS-INT-002 (load_scale) / CAS-INT-003 (gen_pmax_mw), against
// load_gen_sweep.json's 40 cases (8 of which force partial shed, not the all-or-nothing total-load
// shed the manual M4 QA probe exercised). Mirrors tsPythonParity.test.ts's structure/tolerances.
import { readFileSync, writeFileSync } from 'node:fs'
import highsLoader from 'highs'
import { expect, it } from 'vitest'
import { solveDcopf, type ScenarioParams } from '../../src/engine/dcopf'
import type { Case30 } from '../../src/engine/types'

const root = new URL('../../', import.meta.url)
const c30: Case30 = JSON.parse(readFileSync(new URL('public/data/raw-metadata/case30.json', root), 'utf8'))
const sweep = JSON.parse(readFileSync(new URL('verification/REFERENCE_RESULTS/load_gen_sweep.json', root), 'utf8'))
const highs = await highsLoader()
const rel = (a: number, b: number) => Math.abs(a - b) / (Math.abs(a) > 1e-9 ? Math.abs(a) : 1)
const maxAbs = (a: (number | null)[]) => Math.max(0, ...a.filter((v): v is number => v != null).map(Math.abs))

it('40-case load_scale/gen_pmax_mw TS/Python parity, including 8 partial-shed cases', () => {
  const rows = sweep.cases.map((k: any) => {
    const r = solveDcopf(c30, highs, k.scenario as ScenarioParams)
    const pb = maxAbs(k.per_island_balance), tb = maxAbs(r.islands.map((i) => i.balance_mw ?? null))
    const od = rel(k.objective, r.objective), sd = rel(k.total_shed, r.total_unserved_mw)
    return { case_id: k.case_id, python_objective: k.objective, ts_objective: r.objective, objective_delta_relative: od,
      python_shed: k.total_shed, ts_shed: r.total_unserved_mw, shed_delta_relative: sd,
      python_balance_max: pb, ts_balance_max: tb, ts_status: r.status, pass: od <= 1e-3 && sd <= 1e-3 && tb <= 1e-6 && r.status === k.status }
  })
  const fails = rows.filter((r: any) => !r.pass)
  writeFileSync(new URL('verification/REFERENCE_RESULTS/load_gen_parity.json', root), JSON.stringify({
    meta: { n: rows.length, passed: rows.length - fails.length, tol_rel: 1e-3, tol_balance_mw: 1e-6 }, rows }, null, 1))
  console.log(`LOAD_GEN_PARITY ${rows.length - fails.length}/${rows.length}`, JSON.stringify(fails))
  expect(rows.length).toBe(40)
  expect(fails).toEqual([])
  const partial = rows.filter((r: any) => r.ts_shed > 1e-6 && r.ts_shed < 189.2 - 1e-6)
  expect(partial.length).toBeGreaterThan(0) // proves this sweep exercises real dispatch, not just all-or-nothing
})
