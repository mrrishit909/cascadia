import { createRequire } from 'node:module'
const require = createRequire('/Users/rishitmathurrishit/cascadia/package.json')
const { chromium } = require('@playwright/test')
const b = await chromium.launch(); const p = await b.newPage()
await p.goto('http://localhost:4173/')
// Reduce multiple generators to near-zero to force real shedding
for (let gi = 1; gi <= 6; gi++) {
  await p.locator('section:has-text("Reduce generator") select').first().selectOption({ index: gi })
  await p.waitForTimeout(100)
  const slider = p.locator('section:has-text("Reduce generator") input[type=range]')
  await slider.fill('0')
  await p.getByRole('button', { name: 'Apply limit' }).click()
  await p.waitForTimeout(500)
}
console.log('after reducing all 6 gens to 0:')
console.log(await p.locator('section:has-text("Reduce generator")').locator('p[role="status"]').last().textContent())
await p.screenshot({ path: '/tmp/m4_shed_check.png', fullPage: true })
await b.close()
