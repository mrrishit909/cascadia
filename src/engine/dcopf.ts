// TypeScript port of research/models/oracle.py (island-aware DC-OPF). Keep in lockstep with it.
// Pure function over an injected HiGHS instance so it runs in a Worker (browser) or Node (tests).
import type { Case30, Island, Line, SolveResult } from './types'

export const VOLL = 1000
export const N_SEG = 4
export const MAX_RESTORE = 5
export type CandidateLine = Pick<Line, 'idx' | 'from_bus' | 'to_bus' | 'x_pu' | 'rating_mw'>
const TOL = 1e-6

export interface ScenarioParams {
  removed_buses?: number[]
  line_capacity_factor?: Record<string, number>
  disabled_lines?: number[]
  added_lines?: number[] // SYNTHETIC candidate-line positions (candidate_lines.json), idx = 41 + position
  gen_pmax_mw?: Record<string, number>
  load_scale?: Record<string, number>
  allow_shed?: boolean
}
export interface SolverLike { solve(problem: string): { Status: string; ObjectiveValue: number; Columns?: Record<string, unknown> } }
export interface DcopfResult extends SolveResult {
  unserved_removed_mw: number; shed_no_generation_mw: number; shed_economic_mw: number
}

const fin = (v: number) => Number.isFinite(v)

function validate(c: Case30, sc: ScenarioParams, cands: CandidateLine[]) {
  const nb = c.buses.length, nl = c.lines.length, ng = c.gens.length
  for (const b of sc.removed_buses ?? []) if (!(Number.isInteger(b) && b >= 0 && b < nb)) throw new Error(`invalid bus ${b}`)
  for (const [k, f] of Object.entries(sc.line_capacity_factor ?? {})) {
    if (!(+k >= 0 && +k < nl)) throw new Error(`invalid line ${k}`)
    if (!(fin(f) && f >= 0)) throw new Error(`invalid capacity factor ${f} for line ${k}`)
  }
  for (const k of sc.disabled_lines ?? []) if (!(k >= 0 && k < nl)) throw new Error(`invalid line ${k}`)
  for (const [k, v] of Object.entries(sc.gen_pmax_mw ?? {})) {
    if (!(+k >= 0 && +k < ng)) throw new Error(`invalid generator ${k}`)
    if (!(fin(v) && v >= 0)) throw new Error(`invalid Pmax ${v}`)
  }
  for (const [k, f] of Object.entries(sc.load_scale ?? {})) {
    if (!(+k >= 0 && +k < nb)) throw new Error(`invalid bus ${k}`)
    if (!(fin(f) && f >= 0)) throw new Error(`invalid load scale ${f}`)
  }
  for (const k of sc.added_lines ?? []) if (!(Number.isInteger(k) && k >= 0 && k < cands.length)) throw new Error(`invalid candidate line ${k}`)
  for (const l of [...c.lines, ...cands]) if (!(l.x_pu > 0)) throw new Error('non-positive reactance')
}

// Gauss-Jordan inverse with partial pivoting (n <= 30).
function invert(m: number[][]): number[][] {
  const n = m.length
  const a = m.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))])
  for (let i = 0; i < n; i++) {
    let p = i
    for (let r = i + 1; r < n; r++) if (Math.abs(a[r][i]) > Math.abs(a[p][i])) p = r
    if (Math.abs(a[p][i]) < 1e-12) throw new Error('singular B matrix')
    ;[a[i], a[p]] = [a[p], a[i]]
    const d = a[i][i]
    for (let j = 0; j < 2 * n; j++) a[i][j] /= d
    for (let r = 0; r < n; r++) if (r !== i) {
      const f = a[r][i]
      if (f !== 0) for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[i][j]
    }
  }
  return a.map((r) => r.slice(n))
}

const term = (c: number, v: string) => `${c < 0 ? '-' : '+'} ${Math.abs(c)} ${v}`

interface IslandOut { status: 'optimal' | 'infeasible'; message?: string; objective: number; gen: Record<number, number>; shed: Record<number, number>; flows: Record<number, number>; balance: number }

function solveIsland(c: Case30, solver: SolverLike, buses: number[], lines: number[], gens: number[],
  load: Record<number, number>, pmax: Record<number, number>, rating: Record<number, number>, allowShed: boolean): IslandOut {
  const bpos = new Map(buses.map((b, i) => [b, i]))
  const nB = buses.length
  // PTDF, reference = first bus: flow = ptdf @ injection
  const ptdf: number[][] = lines.map(() => new Array(nB).fill(0))
  if (lines.length) {
    const Bbus = Array.from({ length: nB }, () => new Array(nB).fill(0))
    lines.forEach((li) => {
      const l = c.lines[li], i = bpos.get(l.from_bus)!, j = bpos.get(l.to_bus)!, y = 1 / l.x_pu
      Bbus[i][i] += y; Bbus[j][j] += y; Bbus[i][j] -= y; Bbus[j][i] -= y
    })
    const inv = nB > 1 ? invert(Bbus.slice(1).map((r) => r.slice(1))) : []
    lines.forEach((li, k) => {
      const l = c.lines[li], i = bpos.get(l.from_bus)!, j = bpos.get(l.to_bus)!, y = 1 / l.x_pu
      for (let b = 1; b < nB; b++) {
        let s = 0
        if (i >= 1) s += inv[i - 1][b - 1]
        if (j >= 1) s -= inv[j - 1][b - 1]
        ptdf[k][b] = y * s
      }
    })
  }
  // variables: segments per gen, then shed per load bus
  const segs: { g: number; w: number; bus: number }[] = [], cost: number[] = []
  let cst = 0
  for (const g of gens) {
    const G = c.gens[g], hi = pmax[g]
    const lo = hi < G.pmin_mw ? hi : G.pmin_mw // Pmax override below Pmin: Pmin relaxed (documented)
    cst += G.c0 + G.c1 * lo + G.c2 * lo * lo
    const w = (hi - lo) / N_SEG
    for (let s = 0; s < N_SEG; s++) {
      const a = lo + s * w, b = lo + (s + 1) * w
      segs.push({ g, w, bus: bpos.get(G.bus)! }); cost.push(G.c1 + G.c2 * (a + b))
    }
  }
  const nG = segs.length
  const lbuses = buses.filter((b) => (load[b] ?? 0) > 0)
  const ub = [...segs.map((s) => s.w), ...lbuses.map((b) => (allowShed ? load[b] : 0))]
  const colBus = [...segs.map((s) => s.bus), ...lbuses.map((b) => bpos.get(b)!)]
  const objc = [...cost, ...lbuses.map(() => VOLL)]
  const nvar = nG + lbuses.length
  const d = buses.map((b) => load[b] ?? 0)
  const loInj = new Array(nB).fill(0)
  for (const g of gens) loInj[bpos.get(c.gens[g].bus)!] += Math.min(c.gens[g].pmin_mw, pmax[g])
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0)

  const rows: string[] = [`bal: ${Array.from({ length: nvar }, (_, j) => `+ 1 x${j}`).join(' ')} = ${sum(d) - sum(loInj)}`]
  lines.forEach((li, k) => {
    const coef = colBus.map((b) => ptdf[k][b])
    let f0 = 0
    for (let b = 0; b < nB; b++) f0 += ptdf[k][b] * (loInj[b] - d[b])
    const lhs = coef.map((v, j) => (v === 0 ? '' : term(v, `x${j}`))).filter(Boolean).join(' ') || '+ 0 x0'
    const neg = coef.map((v, j) => (v === 0 ? '' : term(-v, `x${j}`))).filter(Boolean).join(' ') || '+ 0 x0'
    rows.push(`up${k}: ${lhs} <= ${rating[li] - f0}`, `lo${k}: ${neg} <= ${rating[li] + f0}`)
  })
  const lp = `Minimize\n obj: ${objc.map((v, j) => term(v, `x${j}`)).join(' ')}\nSubject To\n ${rows.join('\n ')}\nBounds\n ${ub.map((u, j) => `0 <= x${j} <= ${u}`).join('\n ')}\nEnd\n`
  const r = solver.solve(lp)
  if (r.Status !== 'Optimal') return { status: 'infeasible', message: r.Status, objective: 0, gen: {}, shed: {}, flows: {}, balance: 0 }
  const x = Array.from({ length: nvar }, (_, j) => (r.Columns![`x${j}`] as { Primal: number }).Primal)
  const gen: Record<number, number> = {}
  for (const g of gens) gen[g] = Math.min(c.gens[g].pmin_mw, pmax[g])
  segs.forEach((s, j) => { gen[s.g] += x[j] })
  const shed: Record<number, number> = {}
  lbuses.forEach((b, j) => { shed[b] = x[nG + j] })
  const inj = loInj.map((v, b) => v - d[b])
  x.forEach((v, j) => { inj[colBus[j]] += v })
  const flows: Record<number, number> = {}
  lines.forEach((li, k) => { flows[li] = ptdf[k].reduce((s, p, b) => s + p * inj[b], 0) })
  const shedSum = sum(Object.values(shed))
  return { status: 'optimal', objective: r.ObjectiveValue + cst, gen, shed, flows,
    balance: sum(Object.values(gen)) - (sum(d) - shedSum) }
}

export function solveDcopf(c0: Case30, solver: SolverLike, sc: ScenarioParams = {}, cands: CandidateLine[] = []): DcopfResult {
  validate(c0, sc, cands)
  const added = new Set(sc.added_lines ?? [])
  const n0 = c0.lines.length
  // unadded candidates are appended as disabled lines so line idx stays the array position (mirrors oracle.py)
  const c: Case30 = added.size ? { ...c0, lines: [...c0.lines, ...cands.map((l, k) => ({ ...(l as Line), idx: n0 + k }))] } : c0
  const removed = new Set(sc.removed_buses ?? [])
  const allowShed = sc.allow_shed ?? true
  const off = new Set((sc.disabled_lines ?? []).map(Number))
  if (added.size) cands.forEach((_, k) => { if (!added.has(k)) off.add(n0 + k) })
  const pmax: Record<number, number> = {}
  for (const g of c.gens) pmax[g.idx] = sc.gen_pmax_mw?.[g.idx] ?? g.pmax_mw
  const load: Record<number, number> = {}
  for (const l of c.loads) load[l.bus] = (load[l.bus] ?? 0) + l.p_mw * (sc.load_scale?.[l.bus] ?? 1)
  const rating: Record<number, number> = {}
  for (const l of c.lines) rating[l.idx] = l.rating_mw * (sc.line_capacity_factor?.[l.idx] ?? 1)
  const live = c.lines.filter((l) => !off.has(l.idx) && !removed.has(l.from_bus) && !removed.has(l.to_bus)).map((l) => l.idx)

  // Hand-rolled connected components (DFS) over non-removed buses and live lines.
  const adj = new Map<number, number[]>()
  for (const b of c.buses) if (!removed.has(b.idx)) adj.set(b.idx, [])
  for (const i of live) { const l = c.lines[i]; adj.get(l.from_bus)!.push(l.to_bus); adj.get(l.to_bus)!.push(l.from_bus) }
  const seen = new Set<number>(), comps: number[][] = []
  for (const s of adj.keys()) {
    if (seen.has(s)) continue
    const comp: number[] = [], stack = [s]; seen.add(s)
    while (stack.length) { const u = stack.pop()!; comp.push(u); for (const v of adj.get(u)!) if (!seen.has(v)) { seen.add(v); stack.push(v) } }
    comps.push(comp.sort((a, b) => a - b))
  }
  comps.sort((a, b) => a[0] - b[0])
  const genAt: Record<number, number[]> = {}
  for (const g of c.gens) if (!removed.has(g.bus)) (genAt[g.bus] ??= []).push(g.idx)

  const out = { islands: [] as Island[], gen: {} as Record<string, number>, shed: {} as Record<string, number>,
    flows: {} as Record<string, number>, diagnostics: [] as string[], status: 'optimal' }
  let obj = 0, shedNoGen = 0, shedEcon = 0
  const unservedRemoved = [...removed].reduce((s, b) => s + (load[b] ?? 0), 0)
  for (const comp of comps) {
    const cs = new Set(comp)
    const gs = comp.flatMap((b) => genAt[b] ?? [])
    const ls = live.filter((i) => cs.has(c.lines[i].from_bus))
    const tot = comp.reduce((s, b) => s + (load[b] ?? 0), 0)
    const isl: Island = { buses: comp, load_mw: tot, has_generation: gs.length > 0 }
    if (!gs.length) {
      Object.assign(isl, { status: 'no_generation', served_mw: 0, shed_mw: tot, balance_mw: 0, kind: 'shed_no_generation' })
      if (tot > 0) {
        out.diagnostics.push(`island [${comp}] has no generation: ${tot.toPrecision(4)} MW load shed (infeasible to serve)`)
        if (!allowShed) out.status = 'infeasible'
      }
      for (const b of comp) if ((load[b] ?? 0) > 0) out.shed[b] = load[b]
      shedNoGen += tot; obj += VOLL * tot
    } else {
      const r = solveIsland(c, solver, comp, ls, gs, load, pmax, rating, allowShed)
      if (r.status !== 'optimal') {
        Object.assign(isl, { status: 'infeasible', message: r.message, shed_mw: null, balance_mw: null })
        out.status = 'infeasible'
        out.diagnostics.push(`island [${comp}] infeasible with shedding disabled: generation/line limits cannot serve ${tot.toPrecision(4)} MW`)
      } else {
        const s = Object.values(r.shed).reduce((a, b) => a + b, 0)
        Object.assign(isl, { status: 'optimal', served_mw: tot - s, shed_mw: s, balance_mw: r.balance, objective: r.objective, kind: 'economic_shed' })
        Object.assign(out.gen, r.gen); Object.assign(out.flows, r.flows)
        for (const [b, v] of Object.entries(r.shed)) if (v > TOL) out.shed[b] = v
        shedEcon += s; obj += r.objective
        for (const [li, f] of Object.entries(r.flows))
          if (Math.abs(f) >= rating[+li] - 1e-6 && rating[+li] > 0) out.diagnostics.push(`line ${li} binding at ${rating[+li].toPrecision(4)} MW`)
      }
    }
    out.islands.push(isl)
  }
  for (const g of c.gens) out.gen[g.idx] ??= 0
  const binding = Object.entries(out.flows).filter(([li, f]) => rating[+li] > 0 && Math.abs(f) >= rating[+li] - 1e-6).map(([li]) => +li).sort((a, b) => a - b)
  return { ...out, binding_lines: binding, line_rating_mw: Object.fromEntries(Object.entries(rating).filter(([i]) => !off.has(+i) || +i < n0)), objective: obj, unserved_removed_mw: unservedRemoved,
    shed_no_generation_mw: shedNoGen, shed_economic_mw: shedEcon, total_unserved_mw: unservedRemoved + shedNoGen + shedEcon,
    total_load_mw: Object.values(load).reduce((a, b) => a + b, 0) }
}

// ---- CAS-INT-006: restoration sequencing (mirror of oracle.py; see the METRIC comment there) -----------------
// Metric: served_mw_steps = sum over states 0..k-1 (after i restorations) of total_load - total_unserved, one equal
// time step per restoration action (labeled assumption, MW*steps not MWh). Final state excluded (same for all orders).
// Ties within 1e-6 break by lexicographic order. All k! orders enumerated, k <= 5.
export interface DownElement { kind: 'bus' | 'line'; id: number }
export interface RestoreStep { step: number; restored: number[]; served_mw: number; unserved_mw: number; status: string }
export interface RestoreSeq { order: number[]; steps: RestoreStep[]; served_mw_steps: number; final_served_mw: number; rank?: number }

function restoreState(base: ScenarioParams, down: DownElement[], restored: Set<number>): ScenarioParams {
  const pick = (kind: string, init?: number[]) => [...new Set([...(init ?? []), ...down.filter((e, i) => e.kind === kind && !restored.has(i)).map((e) => e.id)])].sort((a, b) => a - b)
  return { ...base, removed_buses: pick('bus', base.removed_buses), disabled_lines: pick('line', base.disabled_lines) }
}

export function restorationOrders(k: number): number[][] {
  if (!(Number.isInteger(k) && k >= 0 && k <= MAX_RESTORE)) throw new Error(`at most ${MAX_RESTORE} down elements supported, got ${k}`)
  const out: number[][] = []
  const rec = (cur: number[], rest: number[]) => { if (!rest.length) out.push(cur); rest.forEach((v, i) => rec([...cur, v], rest.filter((_, j) => j !== i))) }
  rec([], Array.from({ length: k }, (_, i) => i))
  return out // lexicographic, same as itertools.permutations
}

export function restorationSequence(c: Case30, solver: SolverLike, down: DownElement[], order: number[], base: ScenarioParams = {},
  cands: CandidateLine[] = [], cache: Map<string, RestoreStep> = new Map()): RestoreSeq {
  const k = down.length
  if ([...order].sort((a, b) => a - b).join() !== Array.from({ length: k }, (_, i) => i).join()) throw new Error('order must be a permutation of down-element indices')
  for (const e of down) if (e.kind !== 'bus' && e.kind !== 'line') throw new Error(`invalid element kind ${e.kind}`)
  const steps: RestoreStep[] = []
  for (let i = 0; i <= k; i++) {
    const rs = order.slice(0, i), key = [...rs].sort((a, b) => a - b).join()
    if (!cache.has(key)) {
      const r = solveDcopf(c, solver, restoreState(base, down, new Set(rs)), cands)
      cache.set(key, { step: 0, restored: [], served_mw: r.total_load_mw - r.total_unserved_mw, unserved_mw: r.total_unserved_mw, status: r.status })
    }
    steps.push({ ...cache.get(key)!, step: i, restored: i ? [order[i - 1]] : [] })
  }
  return { order: [...order], steps, served_mw_steps: steps.slice(0, k).reduce((s, x) => s + x.served_mw, 0), final_served_mw: steps[k].served_mw }
}

export function rankRestoration(c: Case30, solver: SolverLike, down: DownElement[], orders?: number[][], base: ScenarioParams = {},
  cands: CandidateLine[] = []): RestoreSeq[] {
  const os = orders ?? restorationOrders(down.length)
  if (!os.length) throw new Error('need at least one order')
  const cache = new Map<string, RestoreStep>()
  const res = os.map((o) => restorationSequence(c, solver, down, o, base, cands, cache))
  const lex = (a: number[], b: number[]) => { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]; return a.length - b.length }
  res.sort((a, b) => { const d = b.served_mw_steps - a.served_mw_steps; return Math.abs(d) > 1e-6 ? (d < 0 ? -1 : 1) : lex(a.order, b.order) })
  res.forEach((r, i) => { r.rank = i === 0 ? 1 : Math.abs(res[i - 1].served_mw_steps - r.served_mw_steps) <= 1e-6 ? res[i - 1].rank! : i + 1 })
  return res
}
