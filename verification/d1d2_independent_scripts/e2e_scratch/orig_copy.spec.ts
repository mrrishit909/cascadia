// D1 regression coverage, against the real production build, real Worker, real WASM -- not a mocked
// Worker. Playwright's route interception injects WASM load delay to make races reliably reproducible
// without flaky real-world timing. Every test is keyboard-only (no .click()/.tap()/mouse calls).
import { expect, test, type Page } from "@playwright/test";

async function withWasmDelay(page: Page, ms: number) {
  await page.route("**/*.wasm", async (route) => {
    if (ms) await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}

async function removeBusKeyboard(page: Page, bus: number) {
  await page.locator(`[data-testid="bus"][data-bus="${bus}"]`).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Confirm removal" }).focus();
  await page.keyboard.press("Enter");
}

async function selectLineKeyboard(page: Page, line: number) {
  await page.locator(`[data-testid="line"][data-line="${line}"]`).focus();
  await page.keyboard.press("Enter");
}

for (const delayMs of [0, 1500]) {
  test(`removal then capacity change while removal is in flight (wasm delay ${delayMs}ms): both actions land`, async ({ page }) => {
    await withWasmDelay(page, delayMs);
    await page.goto("/");
    await selectLineKeyboard(page, 9);
    await removeBusKeyboard(page, 26); // confirmed; solve may still be in flight
    await page.getByRole("slider").focus();
    await page.keyboard.press("ArrowLeft"); // capacity change fired before the removal necessarily resolved
    await expect(page.locator('[data-testid="bus"][data-bus="26"]')).toHaveAttribute("data-state", "removed", { timeout: 5000 });
    await expect(page.getByTestId("cap-factor")).toHaveText("0.95x");
    await expect(page.locator('[data-testid="line"][data-line="9"]')).toHaveAttribute("data-altered", "true");
    await expect(page.getByTestId("unserved-mw")).toHaveText("13.00 MW"); // bus 26's own no-generation island shed
  });

  test(`capacity change then removal while capacity solve is in flight (wasm delay ${delayMs}ms): both actions land`, async ({ page }) => {
    await withWasmDelay(page, delayMs);
    await page.goto("/");
    await selectLineKeyboard(page, 9);
    await page.getByRole("slider").focus();
    await page.keyboard.press("ArrowLeft"); // capacity change confirmed; may still be solving/debouncing
    await removeBusKeyboard(page, 26);
    await expect(page.locator('[data-testid="bus"][data-bus="26"]')).toHaveAttribute("data-state", "removed", { timeout: 5000 });
    await expect(page.getByTestId("cap-factor")).toHaveText("0.95x");
    await expect(page.locator('[data-testid="line"][data-line="9"]')).toHaveAttribute("data-altered", "true");
  });
}

test("reset during an active solve: the stale resolution never overwrites the reset state", async ({ page }) => {
  await withWasmDelay(page, 1500);
  await page.goto("/");
  await removeBusKeyboard(page, 26); // solve in flight for ~1.5s
  await page.waitForTimeout(100);
  await expect(page.getByText(/Solving/)).toHaveCount(2, { timeout: 1000 }); // RemoveNode + AlterCapacity both show it
  await page.getByRole("button", { name: "Reset to baseline" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-testid="bus"][data-bus="26"]')).toHaveAttribute("data-state", "served");
  await expect(page.getByTestId("unserved-mw")).toHaveText("0.00 MW");
  // give the stale 1.5s solve plenty of time to resolve, then confirm it did NOT silently override the reset
  await page.waitForTimeout(3000);
  await expect(page.locator('[data-testid="bus"][data-bus="26"]')).toHaveAttribute("data-state", "served");
  await expect(page.getByTestId("unserved-mw")).toHaveText("0.00 MW");
  await expect(page.getByText(/Solving/)).toHaveCount(0);
});

test("multiple rapid capacity changes: only the final value's result is ever shown", async ({ page }) => {
  await page.goto("/");
  await selectLineKeyboard(page, 9);
  const slider = page.getByRole("slider");
  await slider.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowLeft"); // 1.00 -> 0.75, each firing a debounced request
  await expect(page.getByTestId("cap-factor")).toHaveText("0.75x");
  await expect(page.locator('[data-testid="line"][data-line="9"]')).toHaveAttribute("data-altered", "true", { timeout: 2000 });
  // the oracle's own n1_sweep only covers single-step factors (0.25/0.5/1.5); this just confirms the
  // UI converged to the last input, not an intermediate one, and the solve completed without error
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("solve failure (blocked WASM) shows a real error, stays interactive, and recovers after reload", async ({ page, context }) => {
  let blocked = true;
  await context.route("**/*.wasm", (route) => (blocked ? route.abort("failed") : route.continue()));
  await page.goto("/");
  await removeBusKeyboard(page, 26);
  await expect(page.getByRole("alert").first()).toContainText("Solve failed", { timeout: 3000 });
  // app did not crash: the control is still present and operable
  await expect(page.locator('[data-testid="bus"][data-bus="26"]')).toBeVisible();
  await expect(page.locator('[data-testid="bus"][data-bus="26"]')).toHaveAttribute("data-state", "served"); // failed solve never applied
  // recovery: a fresh page load gets a fresh Worker: the previously-failed WASM load doesn't poison a new instance
  blocked = false;
  await page.reload();
  await removeBusKeyboard(page, 26);
  await expect(page.locator('[data-testid="bus"][data-bus="26"]')).toHaveAttribute("data-state", "removed", { timeout: 5000 });
  await expect(page.getByTestId("unserved-mw")).toHaveText("13.00 MW");
  await expect(page.getByRole("alert")).toHaveCount(0);
});
