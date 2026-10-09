// Independent D2 check: infeasible treatment in map + both panels, and that it clears on return to feasible.
import { open, selLine, removeBus, slider, settle, snap } from './lib.mjs'
const SS = '/Users/rishitmathurrishit/cascadia/verification/SCREENSHOTS'
const audit = p => p.evaluate(() => {
  const lines = [...document.querySelectorAll('[data-testid="line"]')], buses = [...document.querySelectorAll('[data-testid="bus"]')]
  const cnt = (els, f) => els.reduce((m, e) => { const k = f(e); m[k] = (m[k] ?? 0) + 1; return m }, {})
  const txt = id => document.querySelector(`[data-testid="${id}"]`)?.textContent ?? null
  return {
    lineBinding: cnt(lines, e => e.getAttribute('data-binding') ?? 'dead'), busState: cnt(buses, e => e.dataset.state),
    labelsWithMW: lines.filter(e => / MW/.test(e.getAttribute('aria-label') ?? '')).length,
    busLabelsServed: buses.filter(e => /served/.test(e.getAttribute('aria-label') ?? '')).length,
    sampleLine: lines.find(e => e.dataset.line === '9')?.getAttribute('aria-label'),
    line9Sel: lines.find(e => e.dataset.line === '9')?.getAttribute('aria-pressed'),
    line9SelHighlightDrawn: !!lines.find(e => e.dataset.line === '9')?.querySelector('line[stroke="#6FA9BE"]'),
    sampleBus: buses.find(e => e.dataset.bus === '5')?.getAttribute('aria-label'),
    svgLabel: document.querySelector('svg[role=img]').getAttribute('aria-label'),
    unserved: txt('unserved-mw'), capUnserved: txt('cap-unserved'), binding: txt('binding-lines'), capFlow: txt('cap-flow'),
    shedList: !!document.querySelector('[data-testid="shed-economic"]'),
    alerts: document.querySelectorAll('[role=alert]').length,
    anyZeroMW: /\b0\.00 MW\b/.test(document.querySelector('main').innerText),
    mainText: document.querySelector('main').innerText.replace(/\n+/g, ' | ').slice(0, 600),
  }
})
{ // 1: infeasible via line 9 at 0.25x, shedding off; then back to feasible by raising capacity
  const { b, p } = await open(0)
  await selLine(p, 9); await p.getByRole('checkbox').focus(); await p.keyboard.press('Space'); await settle(p)
  await slider(p, 'ArrowLeft', 15); await settle(p)
  console.log('INFEASIBLE (line9 0.25x, no shed):', JSON.stringify(await audit(p), null, 1))
  await p.screenshot({ path: `${SS}/indep-review-D2-infeasible.png`, fullPage: true })
  await slider(p, 'ArrowRight', 15); await settle(p)
  console.log('BACK TO 1.00x (no shed):', JSON.stringify(await audit(p), null, 1))
  await p.screenshot({ path: `${SS}/indep-review-D2-recovered.png`, fullPage: true })
  await b.close()
}
{ // 2: infeasible WITH a removed bus (bus 26 removed -> no-gen island; shedding off makes it infeasible)
  const { b, p } = await open(0)
  await removeBus(p, 26); await settle(p)
  await selLine(p, 9); await p.getByRole('checkbox').focus(); await p.keyboard.press('Space'); await settle(p)
  const s = await snap(p)
  console.log('INFEASIBLE + bus 26 removed:', JSON.stringify({ ...(await audit(p)), bus26: s.bus26, deadLines: s.deadLines }, null, 1))
  await p.screenshot({ path: `${SS}/indep-review-D2-infeasible-with-removal.png`, fullPage: true })
  await b.close()
}
