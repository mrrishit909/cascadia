import { createRequire } from 'node:module'
const require = createRequire('/Users/rishitmathurrishit/cascadia/package.json')
const { chromium } = require('@playwright/test')
const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage()
const delay = +process.argv[2]
if (delay) await ctx.route('**/*.wasm', async r => { await new Promise(s => setTimeout(s, delay)); await r.continue() })
await p.goto('http://localhost:4173/')
await p.locator('[data-testid="line"][data-line="9"]').focus(); await p.keyboard.press('Enter') // line 9 selected, slider shown
await p.locator('[data-testid="bus"][data-bus="26"]').focus(); await p.keyboard.press('Enter')
await p.getByRole('button', { name: 'Confirm removal' }).focus(); await p.keyboard.press('Enter') // removal in flight
await p.getByRole('slider').focus(); await p.keyboard.press('ArrowLeft') // capacity 0.95x while removal pending
console.log('during: solving status present =', await p.getByText('Solving island-aware DC-OPF in Worker...').count())
await p.waitForTimeout(4000)
const L9 = p.locator('[data-testid="line"][data-line="9"]')
console.log(`delay=${delay}ms -> bus26 state:`, await p.locator('[data-testid="bus"][data-bus="26"]').getAttribute('data-state'),
  '| unserved', await p.getByTestId('unserved-mw').textContent(), '| cap-factor', await p.getByTestId('cap-factor').textContent(),
  '| line9 altered', await L9.getAttribute('data-altered'), '| provenance', await p.locator('.provenance').textContent())
await p.screenshot({ path: `/tmp/casc_review/race_reverse_${delay}.png`, fullPage: true })
await b.close()
