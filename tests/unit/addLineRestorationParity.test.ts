// @vitest-environment node
// TS-vs-Python parity for CAS-INT-004 (added_lines) and CAS-INT-006 (restoration ranking).
// Reads verification/REFERENCE_RESULTS/add_line_restoration.json (research/evaluate/add_line_restoration.py), writes add_line_restoration_ts_parity.json.
import { readFileSync, writeFileSync } from 'node:fs'
import highsLoader from 'highs'
import { expect, it } from 'vitest'
import { rankRestoration, solveDcopf, type DownElement, type ScenarioParams } from '../../src/engine/dcopf'
import type { Case30 } from '../../src/engine/types'

const root = new URL('../../', import.meta.url)
const c30: Case30 = JSON.parse(readFileSync(new URL('public/data/raw-metadata/case30.json', root), 'utf8'))
const cands = JSON.parse(readFileSync(new URL('public/data/raw-metadata/candidate_lines.json', root), 'utf8')).lines
const ref = JSON.parse(readFileSync(new URL('verification/REFERENCE_RESULTS/add_line_restoration.json', root), 'utf8'))
const highs = await highsLoader()
const rel = (a: number, b: number) => Math.abs(a - b) / (Math.abs(a) > 1e-9 ? Math.abs(a) : 1)
const maxAbs = (a: (number | null)[]) => Math.max(0, ...a.filter((v): v is number => v != null).map(Math.abs))

it('add-line + restoration TS/Python parity', () => {
  const add = ref.add_line_cases.map((k: any) => {
    const r = solveDcopf(c30, highs, k.scenario as ScenarioParams, cands)
    const od = rel(k.objective, r.objective), sd = rel(k.total_shed, r.total_unserved_mw), tb = maxAbs(r.islands.map((i) => i.balance_mw ?? null))
    return { case_id: k.case_id, python_objective: k.objective, ts_objective: r.objective, objective_delta_relative: od, python_shed: k.total_shed,
      ts_shed: r.total_unserved_mw, shed_delta_relative: sd, python_balance_max: maxAbs(k.per_island_balance), ts_balance_max: tb,
      pass: od <= 1e-3 && sd <= 1e-3 && tb <= 1e-6 && r.status === k.status && r.islands.length === k.n_islands }
  })
  const rest = ref.restoration_cases.map((k: any) => {
    const ts = rankRestoration(c30, highs, k.down as DownElement[], undefined, k.base, cands)
    let worst = 0, orderOk = ts.length === k.ranking.length
    k.ranking.forEach((p: any, i: number) => {
      const t = ts[i]
      if (!t || t.rank !== p.rank || t.order.join() !== p.order.join()) { orderOk = false; return }
      worst = Math.max(worst, rel(p.served_mw_steps, t.served_mw_steps), ...p.steps.map((s: any, j: number) => rel(s.served_mw, t.steps[j].served_mw)))
    })
    return { case_id: k.case_id, n_orders: ts.length, max_delta_relative: worst, ranking_identical: orderOk, pass: orderOk && worst <= 1e-3 }
  })
  const fails = [...add, ...rest].filter((r: any) => !r.pass)
  writeFileSync(new URL('verification/REFERENCE_RESULTS/add_line_restoration_ts_parity.json', root), JSON.stringify({
    meta: { n_add: add.length, n_restoration: rest.length, passed: add.length + rest.length - fails.length, tol_rel: 1e-3, tol_balance_mw: 1e-6,
      note: 'restoration: ranking order and ranks must match exactly; served values within tol_rel' }, add_line: add, restoration: rest }, null, 1))
  console.log(`PARITY add ${add.length} restoration ${rest.length} fails`, JSON.stringify(fails))
  expect(add.length).toBe(24)
  expect(fails).toEqual([])
})
