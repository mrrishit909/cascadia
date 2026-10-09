import { createRequire } from 'node:module'
const require = createRequire('/Users/rishitmathurrishit/cascadia/package.json')
const { chromium } = require('@playwright/test')
const b = await chromium.launch(); const p = await b.newPage()
await p.goto('http://localhost:4173/')
await p.waitForTimeout(500)
await p.screenshot({ path: '/tmp/m4_full_page.png', fullPage: true })
await b.close()
