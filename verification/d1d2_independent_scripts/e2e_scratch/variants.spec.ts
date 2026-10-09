// Reviewer variants of e2e/concurrency.spec.ts: harder timing + solver-derived assertions.
import { expect, test, type Page } from '@playwright/test'
async function withWasmDelay(page: Page, ms: number) { await page.route('**/*.wasm', async r => { if (ms) await new Promise(s => setTimeout(s, ms)); await r.continue() }) }
async function removeBusKeyboard(page: Page, bus: number) {
  await page.locator(`[data-testid="bus"][data-bus="${bus}"]`).focus(); await page.keyboard.press('Enter')
  await page.getByRole('button', { name: 'Confirm removal' }).focus(); await page.keyboard.press('Enter')
}
async function selectLineKeyboard(page: Page, line: number) { await page.locator(`[data-testid="line"][data-line="${line}"]`).focus(); await page.keyboard.press('Enter') }
const L9 = (p: Page) => p.locator('[data-testid="line"][data-line="9"]')

for (const delayMs of [50, 250, 300, 600, 3000]) {
  test(`V1 removal then capacity, delay ${delayMs}: solver-derived check`, async ({ page }) => {
    await withWasmDelay(page, delayMs); await page.goto('/')
    await selectLineKeyboard(page, 9); await removeBusKeyboard(page, 26)
    await page.getByRole('slider').focus(); await page.keyboard.press('ArrowLeft')
    await expect(page.locator('[data-bus="28"]')).toHaveAttribute('data-state', 'shed_no_generation', { timeout: 8000 })
    await expect(L9(page)).toHaveAttribute('aria-label', /of 30\.40 MW/, { timeout: 8000 })
    await expect(page.getByTestId('unserved-mw')).toHaveText('13.00 MW')
  })
}
test('V2 capacity solve genuinely IN FLIGHT (debounce elapsed), then removal (delay 1500)', async ({ page }) => {
  await withWasmDelay(page, 1500); await page.goto('/')
  await selectLineKeyboard(page, 9); await page.getByRole('slider').focus(); await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(300) // past the 250ms debounce: the capacity request has now been posted
  await page.locator('[data-bus="26"]').focus(); await page.keyboard.press('Enter')
  await expect(page.getByRole('button', { name: 'Confirm removal' })).toBeEnabled({ timeout: 500 }) // what the test title implies is possible
})
test('V3 rapid capacity changes: the APPLIED value is the final one (0.75x -> 24.00 MW)', async ({ page }) => {
  await page.goto('/'); await selectLineKeyboard(page, 9); await page.getByRole('slider').focus()
  for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowLeft')
  await expect(L9(page)).toHaveAttribute('aria-label', /of 24\.00 MW/, { timeout: 5000 })
})
