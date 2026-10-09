// @vitest-environment node
// Independent TS-vs-Python parity sweep: runs all 195 oracle cases (n1_sweep.json) through solveDcopf
// (the exact function lpWorker.ts calls; the Worker itself is a thin browser wrapper) with Node HiGHS WASM.
// Writes verification/REFERENCE_RESULTS/ts_python_parity.json. Re-run: npx vitest run tests/unit/tsPythonParity.test.ts
import { readFileSync, writeFileSync } from 'node:fs'
import highsLoader from 'highs'
import { expect, it } from 'vitest'
import { solveDcopf, type ScenarioParams } from '../../src/engine/dcopf'
import type { Case30 } from '../../src/engine/types'

const root = new URL('../../', import.meta.url)
const c30: Case30 = JSON.parse(readFileSync(new URL('public/data/raw-metadata/case30.json', root), 'utf8'))
const sweep = JSON.parse(readFileSync(new URL('verification/REFERENCE_RESULTS/n1_sweep.json', root), 'utf8'))
const highs = await highsLoader()
// relative delta; when the oracle value is 0, falls back to absolute delta (no division by zero)
const rel = (a: number, b: number) => Math.abs(a - b) / (Math.abs(a) > 1e-9 ? Math.abs(a) : 1)
const maxAbs = (a: (number | null)[]) => Math.max(0, ...a.filter((v): v is number => v != null).map(Math.abs))

it('195-case TS/Python parity', () => {
  const rows = sweep.cases.map((k: any) => {
    const r = solveDcopf(c30, highs, k.scenario as ScenarioParams)
    const pb = maxAbs(k.per_island_balance), tb = maxAbs(r.islands.map((i) => i.balance_mw ?? null))
    const od = rel(k.objective, r.objective), sd = rel(k.total_shed, r.total_unserved_mw)
    return { case_id: k.case_id, python_objective: k.objective, ts_objective: r.objective, objective_delta_relative: od,
      python_shed: k.total_shed, ts_shed: r.total_unserved_mw, shed_delta_relative: sd,
      python_balance_max: pb, ts_balance_max: tb, ts_status: r.status, pass: od <= 1e-3 && sd <= 1e-3 && tb <= 1e-6 && r.status === k.status }
  })
  const fails = rows.filter((r: any) => !r.pass)
  writeFileSync(new URL('verification/REFERENCE_RESULTS/ts_python_parity.json', root), JSON.stringify({
    meta: { n: rows.length, passed: rows.length - fails.length, tol_rel: 1e-3, tol_balance_mw: 1e-6,
      note: 'ts_shed = total_unserved_mw (removed+no-gen+economic), matching oracle total_shed; rel delta falls back to absolute when oracle value is 0' }, rows }, null, 1))
  console.log(`PARITY ${rows.length - fails.length}/${rows.length}`, JSON.stringify(fails))
  expect(rows.length).toBe(195)
  expect(fails).toEqual([])
})
