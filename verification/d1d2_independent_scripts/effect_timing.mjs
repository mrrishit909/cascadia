// Directly measures when the passive effects of a discrete event run, relative to that event's task:
// wraps clearTimeout (called by AlterCapacity's selectedLine effect) and timestamps calls vs the keydown.
import { open, selLine, slider, settle } from './lib.mjs'
const { b, p } = await open(0)
await selLine(p, 9); await slider(p, 'ArrowLeft'); await settle(p)
for (const target of [10, 9, 10]) {
  const r = await p.evaluate(async target => {
    const log = []; const t0 = performance.now(); let inTask = true
    const oc = window.clearTimeout; window.clearTimeout = function (id) { log.push(['clearTimeout', +(performance.now() - t0).toFixed(2), inTask ? 'SAME task as keydown' : 'LATER task']); return oc.call(this, id) }
    const out = document.querySelector('[data-testid="cap-factor"]')
    const el = document.querySelector(`[data-testid="line"][data-line="${target}"]`); el.focus()
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    log.push(['after dispatch (sync)', +(performance.now() - t0).toFixed(2), 'cap-factor=' + out.textContent])
    queueMicrotask(() => log.push(['microtask', +(performance.now() - t0).toFixed(2), 'cap-factor=' + out.textContent]))
    setTimeout(() => { inTask = false }, 0)
    await new Promise(r => setTimeout(r, 50)); window.clearTimeout = oc
    log.push(['+50ms', +(performance.now() - t0).toFixed(2), 'cap-factor=' + out.textContent]); return log
  }, target)
  console.log(JSON.stringify(r))
}
await b.close()
