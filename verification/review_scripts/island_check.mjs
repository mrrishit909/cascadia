// Independent per-bus/per-island balance check. Does NOT use the engine's own balance_mw field.
import { readFileSync } from 'node:fs'
const R = '/Users/rishitmathurrishit/cascadia/'
const { solveDcopf } = await import(R + 'src/engine/dcopf.ts')
const highs = await (await import(R + 'node_modules/highs/build/highs.js')).default()
const c = JSON.parse(readFileSync(R + 'public/data/raw-metadata/case30.json'))
const sweep = JSON.parse(readFileSync(R + 'verification/REFERENCE_RESULTS/n1_sweep.json')).cases
const scen = ['baseline', 'islanding', 'infeasible'].map(n => ({ case_id: 'edge_' + n, scenario: JSON.parse(readFileSync(R + `public/data/scenarios/${n}.json`)).params, fixture: JSON.parse(readFileSync(R + `public/data/precomputed/${n}.json`)).result }))
function check(id, sc, r) {
  const removed = new Set(sc.removed_buses ?? []), errs = []
  const load = {}; for (const l of c.loads) load[l.bus] = (load[l.bus] ?? 0) + l.p_mw * (sc.load_scale?.[l.bus] ?? 1)
  const islandOf = {}; r.islands.forEach((isl, k) => isl.buses.forEach(b => { if (b in islandOf) errs.push(`bus ${b} in 2 islands`); islandOf[b] = k }))
  for (const b of c.buses) if (!removed.has(b.idx) && !(b.idx in islandOf)) errs.push(`bus ${b.idx} in no island`)
  for (const [li, f] of Object.entries(r.flows)) { const L = c.lines[li]; if (islandOf[L.from_bus] !== islandOf[L.to_bus] && Math.abs(f) > 1e-9) errs.push(`line ${li} carries ${f} across islands`) }
  let worst = 0
  r.islands.forEach((isl, k) => {
    if (isl.status === 'infeasible') return
    const genAt = {}; for (const g of c.gens) if (islandOf[g.bus] === k) genAt[g.bus] = (genAt[g.bus] ?? 0) + (r.gen[g.idx] ?? 0)
    let agg = 0
    for (const b of isl.buses) {
      let net = (genAt[b] ?? 0) - (load[b] ?? 0) + (r.shed[b] ?? 0)
      for (const [li, f] of Object.entries(r.flows)) { const L = c.lines[li]; if (L.from_bus === b) net -= f; if (L.to_bus === b) net += f }
      worst = Math.max(worst, Math.abs(net)); agg += (genAt[b] ?? 0) - (load[b] ?? 0) + (r.shed[b] ?? 0)
    }
    if (Math.abs(agg) > 1e-6) errs.push(`island ${k} aggregate imbalance ${agg}`)
    if (!isl.has_generation) {
      if (Object.values(genAt).some(v => Math.abs(v) > 1e-9)) errs.push(`no-gen island ${k} has generation`)
      if (Math.abs(isl.shed_mw - isl.load_mw) > 1e-9) errs.push(`no-gen island ${k} not fully shed`)
    }
  })
  if (worst > 1e-6) errs.push(`per-bus nodal imbalance ${worst}`)
  return { worst, errs }
}
let n = 0, bad = 0, worstAll = 0, islanded = 0, nogen = 0
for (const k of [...sweep, ...scen]) {
  const r = solveDcopf(c, highs, k.scenario)
  const { worst, errs } = check(k.case_id, k.scenario, r); n++; worstAll = Math.max(worstAll, worst)
  if (r.islands.length > 1) islanded++; if (r.islands.some(i => !i.has_generation && i.load_mw > 0)) nogen++
  if (errs.length) { bad++; console.log('TS FAIL', k.case_id, errs) }
  if (k.fixture) { const p = check(k.case_id + '(python fixture)', k.scenario, k.fixture); console.log(k.case_id, 'ts status', r.status, 'diag', JSON.stringify(r.diagnostics), '| python fixture worst', p.worst, p.errs, 'ts worst', worst) }
}
console.log(`TS per-bus check: ${n - bad}/${n} pass, worst per-bus nodal imbalance ${worstAll} MW, multi-island scenarios ${islanded}, scenarios with a loaded no-gen island ${nogen}`)
