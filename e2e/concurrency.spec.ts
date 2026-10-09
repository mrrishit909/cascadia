// D1/N1 regression coverage, against the real production build, real Worker, real WASM -- not a mocked
// Worker. Playwright's route interception injects WASM load delay to make races reliably reproducible
// without flaky real-world timing. Every test is keyboard-only (no .click()/.tap()/mouse calls).
//
// Revised after an independent adversarial review of the first version of this file found: the local
// "0.95x"/"data-altered" assertions can pass even if the capacity change was never actually applied by
// the solver (both draft-only and solved values happen to read the same in the cases originally tested);
// one test ("capacity change then removal while capacity solve is in flight") never actually had a
// capacity solve in flight, since the removal was confirmed inside the 250ms debounce window before any
// capacity request was even sent -- the real "capacity solve genuinely in flight, then removal" ordering
// is prevented by the Confirm button's disabled state, not exercised by this fix; that's now its own test
// documenting the UI-level guard. All solver-derived assertions below read the aria-label's rating figure
// (sourced from result.line_rating_mw, not the local slider draft) so a regression that reverts to
// draft-only state can't pass silently.
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

const line9AriaLabel = (page: Page) => page.locator('[data-testid="line"][data-line="9"]').getAttribute("aria-label");

for (const delayMs of [0, 1500]) {
  test(`removal then capacity change while removal is in flight (wasm delay ${delayMs}ms): both land, solver-confirmed`, async ({ page }) => {
    await withWasmDelay(page, delayMs);
    await page.goto("/");
    await selectLineKeyboard(page, 9);
    await removeBusKeyboard(page, 26); // confirmed; solve may still be in flight
    await page.getByRole("slider").focus();
    await page.keyboard.press("ArrowLeft"); // capacity change fired before the removal necessarily resolved
    await expect(page.locator('[data-testid="bus"][data-bus="26"]')).toHaveAttribute("data-state", "removed", { timeout: 5000 });
    await expect(page.getByTestId("unserved-mw")).toHaveText("13.00 MW"); // bus 26's own no-generation island shed
    // solver-derived: 0.95 x 32 MW rating = 30.40 MW, read from the aria-label the engine's own
    // line_rating_mw produces -- not the local slider draft, which could read "0.95x" even if the
    // Worker request never actually carried the capacity change.
    await expect.poll(() => line9AriaLabel(page)).toContain("30.40 MW");
  });

  test(`capacity change confirmed inside the debounce window, then removal (wasm delay ${delayMs}ms): both land, solver-confirmed`, async ({ page }) => {
    await withWasmDelay(page, delayMs);
    await page.goto("/");
    await selectLineKeyboard(page, 9);
    await page.getByRole("slider").focus();
    await page.keyboard.press("ArrowLeft"); // capacity change confirmed; still inside its own 250ms debounce
    await removeBusKeyboard(page, 26); // removal's own request is the one that actually reaches the Worker first
    await expect(page.locator('[data-testid="bus"][data-bus="26"]')).toHaveAttribute("data-state", "removed", { timeout: 5000 });
    await expect.poll(() => line9AriaLabel(page)).toContain("30.40 MW");
  });
}

test("capacity solve GENUINELY in flight (300ms wait) blocks a new removal via the disabled Confirm button, not via state logic", async ({ page }) => {
  // Documents the actual UI-level guard for this ordering, per the independent review: Confirm removal
  // is disabled while solve === 'solving', so a capacity solve truly in flight (not just debouncing)
  // cannot race against a removal from this control at all. If this ever starts failing because Confirm
  // becomes enabled during solving, re-add a state-level test for this exact ordering.
  await withWasmDelay(page, 1500);
  await page.goto("/");
  await selectLineKeyboard(page, 9);
  await page.getByRole("slider").focus();
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(300); // past the 250ms debounce: the capacity solve is now genuinely in flight
  await page.locator('[data-testid="bus"][data-bus="26"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Confirm removal" })).toBeDisabled();
  await expect.poll(() => line9AriaLabel(page), { timeout: 3000 }).toContain("30.40 MW"); // capacity change still lands
});

test("reset during an active solve: the stale resolution never overwrites the reset state", async ({ page }) => {
  await withWasmDelay(page, 1500);
  await page.goto("/");
  await removeBusKeyboard(page, 26); // solve in flight for ~1.5s
  await page.waitForTimeout(100);
  // One "Solving..." indicator per control sharing this scenario (every control added over time
  // raises this count -- assert "at least 1", not a specific number, so this isn't brittle to M4's
  // growing control count).
  await expect(page.getByText(/Solving/).first()).toBeVisible({ timeout: 1000 });
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

test("multiple rapid capacity changes: the solver-applied rating matches the final input, not an intermediate one", async ({ page }) => {
  await page.goto("/");
  await selectLineKeyboard(page, 9);
  const slider = page.getByRole("slider");
  await slider.focus();
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowLeft"); // 1.00 -> 0.75, each firing a debounced request
  await expect(page.getByTestId("cap-factor")).toHaveText("0.75x");
  // solver-derived: 0.75 x 32 MW = 24.00 MW -- confirms the Worker actually applied the LAST input, not
  // a lost/intermediate one (the original version of this test never checked the applied value at all).
  await expect.poll(() => line9AriaLabel(page), { timeout: 2000 }).toContain("24.00 MW");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("N1: removing a bus respects the current 'Allow load shedding' setting, not the engine default", async ({ page }) => {
  // N1 (P0, found by independent review): removeBus never sent allow_shed, so it always solved with
  // shedding on regardless of what the checkbox showed -- the same "lost intent" class as D1, just for a
  // field that was never threaded through the shared scenario at all. Fixed by making allowShed part of
  // Scen, read from base() by both removeBus and setCapacity.
  await page.goto("/");
  await selectLineKeyboard(page, 9);
  await page.getByRole("checkbox", { name: "Allow load shedding" }).focus();
  await page.keyboard.press("Space"); // uncheck: shedding disabled
  await expect(page.getByRole("checkbox", { name: "Allow load shedding" })).not.toBeChecked();
  const slider = page.getByRole("slider");
  await slider.focus();
  for (let i = 0; i < 15; i++) await page.keyboard.press("ArrowLeft"); // 1.00x -> 0.25x: infeasible with shedding off
  await expect(page.getByTestId("unserved-mw")).toHaveText("n/a (infeasible)", { timeout: 3000 });
  await removeBusKeyboard(page, 2); // the request this fires must carry allow_shed: false too
  // if N1 regressed, this would come back as a feasible solve with ~16.96 MW of real (not n/a) economic
  // shed, instead of staying infeasible -- the checkbox's intent would have been silently dropped.
  await expect(page.getByTestId("unserved-mw")).toHaveText("n/a (infeasible)", { timeout: 5000 });
  await expect(page.getByRole("checkbox", { name: "Allow load shedding" })).not.toBeChecked();
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
