// Reset while a removal's solve is still in flight. The stale resolution must not later overwrite
// the reset state (epoch guard in state.tsx).
import { createRequire } from 'node:module'
const require = createRequire('/Users/rishitmathurrishit/cascadia/package.json')
const { chromium } = require('@playwright/test')
const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage()
const delay = +process.argv[2]
if (delay) await ctx.route('**/*.wasm', async r => { await new Promise(s => setTimeout(s, delay)); await r.continue() })
await p.goto('http://localhost:4173/')
await p.locator('[data-testid="bus"][data-bus="26"]').focus(); await p.keyboard.press('Enter')
await p.getByRole('button', { name: 'Confirm removal' }).focus(); await p.keyboard.press('Enter') // removal in flight
await p.waitForTimeout(100)
console.log('mid-solve: solving status present =', await p.getByText(/Solving/).count())
await p.getByRole('button', { name: 'Reset to baseline' }).click() // reset while the Worker is still computing
console.log('immediately after reset: bus26 state =', await p.locator('[data-testid="bus"][data-bus="26"]').getAttribute('data-state'),
  '| unserved', await p.getByTestId('unserved-mw').textContent())
await p.waitForTimeout(4000) // let the stale solve resolve, if it's going to
console.log(`delay=${delay}ms -> 4s after reset: bus26 state =`, await p.locator('[data-testid="bus"][data-bus="26"]').getAttribute('data-state'),
  '| unserved', await p.getByTestId('unserved-mw').textContent(), '| solve status text present =', await p.getByText(/Solving/).count())
await b.close()
