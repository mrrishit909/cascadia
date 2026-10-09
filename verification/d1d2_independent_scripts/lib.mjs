// Independent D1/D2 review harness (reviewer-authored; not the implementer's review_scripts).
// Reads SOLVER-DERIVED values (line rating in aria-label = result.line_rating_mw, bus data-state from
// result.islands/shed, provenance label) in addition to UI state.
import { createRequire } from 'node:module'
const require = createRequire('/Users/rishitmathurrishit/cascadia/package.json')
export const { chromium } = require('@playwright/test')
export const URL = process.env.BASE ?? 'http://localhost:4173/'

export async function open(delayMs = 0, { everyWasm = false } = {}) {
  const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage()
  // record every request actually posted to the LP Worker (id + scenario), to see solve-level ordering
  await ctx.addInitScript(() => { window.__posts = []; const o = Worker.prototype.postMessage
    Worker.prototype.postMessage = function (m, ...r) { window.__posts.push({ t: Math.round(performance.now()), id: m?.id, sc: m?.scenario }); return o.call(this, m, ...r) } })
  if (delayMs) await ctx.route('**/*.wasm', async r => { await new Promise(s => setTimeout(s, delayMs)); await r.continue() })
  await p.goto(URL)
  await p.locator('[data-testid="bus"]').first().waitFor()
  return { b, p }
}
export const selLine = async (p, l) => { await p.locator(`[data-testid="line"][data-line="${l}"]`).focus(); await p.keyboard.press('Enter') }
export const selBus = async (p, n) => { await p.locator(`[data-testid="bus"][data-bus="${n}"]`).focus(); await p.keyboard.press('Enter') }
export const confirm = async p => { await p.getByRole('button', { name: 'Confirm removal' }).focus(); await p.keyboard.press('Enter') }
export const removeBus = async (p, n) => { await selBus(p, n); await confirm(p) }
export const slider = async (p, key, n = 1) => { await p.getByRole('slider').focus(); for (let i = 0; i < n; i++) await p.keyboard.press(key) }
export async function settle(p, ms = 4000) {
  await p.waitForTimeout(200)
  await p.waitForFunction(() => !/Solving/.test(document.body.innerText), null, { timeout: ms }).catch(() => {})
  await p.waitForTimeout(400)
}
export async function snap(p) {
  return p.evaluate(() => {
    const q = s => document.querySelector(s)
    const line = i => q(`[data-testid="line"][data-line="${i}"]`)
    const ratingOf = i => { const m = line(i)?.getAttribute('aria-label')?.match(/of ([\d.]+) MW/); return m ? +m[1] : line(i)?.getAttribute('aria-label') }
    return {
      bus26: q('[data-bus="26"]')?.getAttribute('data-state'),
      bus28: q('[data-bus="28"]')?.getAttribute('data-state'),
      bus29: q('[data-bus="29"]')?.getAttribute('data-state'),
      unserved: q('[data-testid="unserved-mw"]')?.textContent,
      capFactor: q('[data-testid="cap-factor"]')?.textContent ?? null,
      sliderValue: q('input[type=range]')?.value ?? null,
      shedBox: q('input[type=checkbox]')?.checked ?? null,
      line9Rating: ratingOf(9), line10Rating: ratingOf(10),
      line9Altered: line(9)?.getAttribute('data-altered'),
      altered: [...document.querySelectorAll('[data-testid="line"][data-altered="true"]')].map(e => +e.dataset.line),
      deadLines: [...document.querySelectorAll('line[data-testid="line"]')].map(e => +e.dataset.line),
      provenance: q('.provenance')?.textContent,
      svgLabel: q('svg[role=img]')?.getAttribute('aria-label'),
      alerts: [...document.querySelectorAll('[role=alert]')].map(e => e.textContent),
      solving: /Solving/.test(document.body.innerText),
      posts: window.__posts.map(x => `#${x.id}@${x.t}:${JSON.stringify(x.sc)}`),
    }
  })
}
