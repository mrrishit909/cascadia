// "Action exactly at the moment another resolves": clicks Reset right after the Worker reply is handled,
// as a separate task (setTimeout 0, like a real click) and as a microtask (before React renders 'solved').
import { chromium, URL, removeBus, selLine, slider, settle, snap } from './lib.mjs'
for (const how of ['task', 'microtask']) for (const first of ['removal', 'capacity']) for (let rep = 0; rep < 3; rep++) {
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage()
  await ctx.addInitScript(how => {
    const d = Object.getOwnPropertyDescriptor(Worker.prototype, 'onmessage') ?? { set: null }
    window.__posts = []; let armed = true
    Object.defineProperty(Worker.prototype, 'onmessage', { configurable: true, get() { return this.__h },
      set(h) { this.__h = h; d.set?.call(this, e => { h(e); if (!armed || !window.__arm) return; armed = false
        const click = () => { window.__resetClickedAtResolve = true; [...document.querySelectorAll('button')].find(x => x.textContent === 'Reset to baseline').click() }
        how === 'task' ? setTimeout(click, 0) : queueMicrotask(click) }) } })
  }, how)
  await p.goto(URL); await p.locator('[data-testid="bus"]').first().waitFor()
  await p.evaluate(() => { window.__arm = true })
  if (first === 'removal') await removeBus(p, 26); else { await selLine(p, 9); await slider(p, 'ArrowLeft') }
  await p.waitForTimeout(1500); await settle(p)
  const s = await snap(p); const fired = await p.evaluate(() => !!window.__resetClickedAtResolve)
  const ok = s.bus26 === 'served' && s.line9Rating === 32 && s.unserved === '0.00 MW' && !s.solving && s.altered.length === 0
  console.log(`${ok ? 'BASELINE' : 'NOT BASELINE'} reset-as-${how} at ${first} resolve rep=${rep} (reset fired=${fired}): bus26=${s.bus26} L9=${s.line9Rating} unserved=${s.unserved} prov="${s.provenance}"`)
  await b.close()
}
