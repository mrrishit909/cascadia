// Real Worker failure (WASM blocked) then recovery (reload, unblocked).
import { createRequire } from 'node:module'
const require = createRequire('/Users/rishitmathurrishit/cascadia/package.json')
const { chromium } = require('@playwright/test')
const b = await chromium.launch(); const ctx = await b.newContext(); const p = await ctx.newPage()
let blockWasm = true
await ctx.route('**/*.wasm', r => blockWasm ? r.abort('failed') : r.continue())
await p.goto('http://localhost:4173/')
await p.locator('[data-testid="bus"][data-bus="26"]').focus(); await p.keyboard.press('Enter')
await p.getByRole('button', { name: 'Confirm removal' }).focus(); await p.keyboard.press('Enter')
await p.waitForTimeout(1000)
console.log('after blocked solve: alert text =', await p.getByRole('alert').allTextContents())
console.log('bus26 state =', await p.locator('[data-testid="bus"][data-bus="26"]').getAttribute('data-state'))
console.log('confirm button still present & re-usable =', await p.locator('[data-testid="bus"][data-bus="26"]').isVisible())
// recovery: unblock and retry the SAME action without reloading (same Worker, same rejected `highs` promise)
blockWasm = false
await p.locator('[data-testid="bus"][data-bus="26"]').focus(); await p.keyboard.press('Enter')
await p.getByRole('button', { name: 'Confirm removal' }).focus(); await p.keyboard.press('Enter')
await p.waitForTimeout(1000)
console.log('retry same worker, unblocked: bus26 state =', await p.locator('[data-testid="bus"][data-bus="26"]').getAttribute('data-state'),
  '| alert =', await p.getByRole('alert').allTextContents())
// recovery via reload (new Worker instance)
await p.reload()
await p.locator('[data-testid="bus"][data-bus="26"]').focus(); await p.keyboard.press('Enter')
await p.getByRole('button', { name: 'Confirm removal' }).focus(); await p.keyboard.press('Enter')
await p.waitForTimeout(1000)
console.log('after reload, unblocked: bus26 state =', await p.locator('[data-testid="bus"][data-bus="26"]').getAttribute('data-state'),
  '| unserved =', await p.getByTestId('unserved-mw').textContent())
await b.close()
