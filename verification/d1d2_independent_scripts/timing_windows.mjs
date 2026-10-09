// Machine-timed probes of the windows between a React dispatch and its render / passive effects.
// F: debounce timer dispatches 'solving' (non-discrete -> render deferred); Confirm removal clicked right after.
// R: Reset clicked a few ms BEFORE the debounce timer fires (reset's passive effects -- epochRef update,
//    timer clear -- have not run yet when the timer callback executes).
import { open, selBus, selLine, settle, snap } from './lib.mjs'
const setSlider = (p, v) => p.evaluate(v => { const i = document.querySelector('input[type=range]')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, String(v)); i.dispatchEvent(new Event('input', { bubbles: true })) }, v)
const mode = process.argv[2] ?? 'F'
if (mode === 'F') for (const off of [250, 251, 252, 254]) for (let rep = 0; rep < 3; rep++) {
  const { b, p } = await open(0)
  await selBus(p, 26); await selLine(p, 9)
  await p.evaluate(off => { window.__fire = () => setTimeout(() => [...document.querySelectorAll('button')].find(x => x.textContent === 'Confirm removal').click(), off) }, off)
  await p.evaluate(() => { const i = document.querySelector('input[type=range]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, '0.95'); i.dispatchEvent(new Event('input', { bubbles: true })); window.__fire() })
  await settle(p, 6000); const s = await snap(p)
  const lost = s.bus26 === 'removed' && s.line9Rating !== 30.4
  console.log(`F off=${off} rep=${rep}: ${lost ? 'CAPACITY LOST' : 'ok'} bus26=${s.bus26} L9rating=${s.line9Rating} capFactor=${s.capFactor} posts=${s.posts.join(' | ')}`)
  await b.close()
}
if (mode === 'R') for (const lead of [0, 1, 2, 3, 4, 6, 8, 12]) for (let rep = 0; rep < 2; rep++) {
  const { b, p } = await open(0)
  await selLine(p, 9); await setSlider(p, 0.95); await settle(p) // confirmed {9:0.95}, so Reset is enabled
  await p.evaluate(lead => { const i = document.querySelector('input[type=range]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, '0.9'); i.dispatchEvent(new Event('input', { bubbles: true }))
    setTimeout(() => [...document.querySelectorAll('button')].find(x => x.textContent === 'Reset to baseline').click(), 250 - lead) }, lead)
  await p.waitForTimeout(2500); const s = await snap(p)
  const stuck = s.solving
  console.log(`R lead=${lead} rep=${rep}: ${stuck ? 'STUCK SOLVING' : s.line9Altered === 'true' ? 'POST-RESET CHANGE APPLIED' : 'ok'} L9=${s.line9Rating} altered=${s.altered} solving=${s.solving} prov="${s.provenance}" posts=${s.posts.join(' | ')}`)
  if (stuck && rep === 0) await p.screenshot({ path: `/Users/rishitmathurrishit/cascadia/verification/SCREENSHOTS/indep-review-R-stuck-solving-lead${lead}.png`, fullPage: true })
  await b.close()
}
