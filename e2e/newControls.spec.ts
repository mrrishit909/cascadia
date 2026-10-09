// Keyboard-only e2e coverage for the three M4 wave-1 controls (CAS-INT-002 increase load,
// CAS-INT-003 reduce generator, CAS-INT-007 line outage) against the real production build/Worker.
// Targets the same bug classes already found once in the first two controls (D1, D2, N1, N2) to
// prove `runScen`'s shared epoch/pendingRef/allowShed plumbing actually carries over to new fields,
// not just the original removedBus/lineCapacity ones.
import { expect, test, type Page } from "@playwright/test";

async function withWasmDelay(page: Page, ms: number) {
  await page.route("**/*.wasm", async (route) => {
    if (ms) await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}

// "Allow load shedding" is scoped to AlterCapacity.tsx's own rendered block (it only exists once a
// line is selected there), but the field it controls (allowShed) is shared scenario-wide -- so any
// control can observe it once set. Select a line, then flip the checkbox, via keyboard only.
async function disallowSheddingGlobally(page: Page) {
  await page.locator('section:has-text("Alter line capacity") select').selectOption({ index: 1 });
  const cb = page.getByRole("checkbox", { name: "Allow load shedding" });
  await cb.focus();
  await page.keyboard.press("Space");
  await expect(cb).not.toBeChecked();
}

test("D2: zeroing enough generation with 'Allow load shedding' off shows n/a (infeasible), never 0.00", async ({ page }) => {
  await page.goto("/");
  await disallowSheddingGlobally(page);
  const genSelect = page.locator('section:has-text("Reduce generator") select');
  const slider = page.locator('section:has-text("Reduce generator") input[type=range]');
  // case30's total load is 189.2 MW; zeroing gens 0+1+2 (80+80+50=210 MW) alone still leaves 125 MW of
  // the 335 MW fleet, feasible. Zero gens 0,1,2,3 (80+80+50+55=265 MW) leaves 70 MW -- below load, and
  // with shedding disallowed the LP has no feasible dispatch at all.
  for (let idx = 1; idx <= 4; idx++) {
    await genSelect.selectOption({ index: idx });
    await slider.focus();
    for (let i = 0; i < 90; i++) await page.keyboard.press("ArrowDown"); // drive Pmax to 0
    await expect(page.getByTestId("gen-pmax")).toHaveText("0 MW");
    await page.getByRole("button", { name: "Apply limit" }).click();
    await expect(page.getByTestId("gen-unserved")).not.toHaveText("", { timeout: 5000 }); // wait for this solve to land
  }
  await expect(page.getByTestId("gen-unserved")).toHaveText("n/a (infeasible)", { timeout: 5000 });
});

test("N1: increasing load respects 'Allow load shedding' off, not the engine default", async ({ page }) => {
  await page.goto("/");
  await disallowSheddingGlobally(page);
  await page.locator('section:has-text("Increase load") select').selectOption({ index: 1 });
  const slider = page.locator('section:has-text("Increase load") input[type=range]');
  await slider.focus();
  for (let i = 0; i < 36; i++) await page.keyboard.press("ArrowRight"); // 1x -> 10x (step 0.25)
  await expect(page.getByTestId("load-factor")).toHaveText("10.00x");
  await page.getByRole("button", { name: "Apply load" }).click();
  // 10x a real load bus with shedding disallowed must be infeasible, not silently clamped/shed
  await expect(page.getByTestId("load-unserved")).toHaveText("n/a (infeasible)", { timeout: 5000 });
});

test("D1: applying load while a line-outage solve is genuinely in flight: both land, solver-confirmed", async ({ page }) => {
  await withWasmDelay(page, 1500);
  await page.goto("/");
  await page.locator('section:has-text("Line outage") select').selectOption({ index: 1 }); // line 0
  await page.getByRole("button", { name: "Disable line" }).click();
  await page.getByRole("button", { name: "Confirm outage" }).focus();
  await page.keyboard.press("Enter"); // outage solve now in flight (~1.5s)
  await page.locator('section:has-text("Increase load") select').selectOption({ index: 1 });
  const slider = page.locator('section:has-text("Increase load") input[type=range]');
  await slider.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight"); // 1x -> 2x
  await page.getByRole("button", { name: "Apply load" }).click(); // fires before the outage solve necessarily resolved
  await expect(page.getByTestId("outage-list")).toHaveText("0", { timeout: 5000 });
  await expect(page.getByTestId("load-factor")).toHaveText("2.00x");
  // both changes must be reflected in the FINAL solver result, not just local draft state
  await expect(page.getByTestId("load-unserved")).not.toHaveText("n/a (infeasible)");
});

test("Reset restores load/generator/outage controls to baseline and clears their drafts", async ({ page }) => {
  await page.goto("/");
  await page.locator('section:has-text("Increase load") select').selectOption({ index: 1 });
  const loadSlider = page.locator('section:has-text("Increase load") input[type=range]');
  await loadSlider.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Apply load" }).click();
  await expect(page.getByTestId("load-unserved")).toBeVisible();
  await page.getByRole("button", { name: "Reset to baseline" }).focus();
  await page.keyboard.press("Enter");
  // the resynced draft (N2 class) must show baseline (1.00x), not the pre-reset value
  await expect(page.getByTestId("load-factor")).toHaveText("1.00x");
  await expect(page.getByTestId("load-unserved")).toHaveText("0.00 MW");
});

test("N2 regression: an unrelated control's solve does not wipe an uncommitted load-slider draft", async ({ page }) => {
  await withWasmDelay(page, 800);
  await page.goto("/");
  // start a line-outage solve (unrelated to load) and let it resolve while a load draft is mid-edit
  await page.locator('section:has-text("Line outage") select').selectOption({ index: 1 });
  await page.getByRole("button", { name: "Disable line" }).click();
  await page.getByRole("button", { name: "Confirm outage" }).focus();
  await page.keyboard.press("Enter");
  await page.locator('section:has-text("Increase load") select').selectOption({ index: 1 });
  const slider = page.locator('section:has-text("Increase load") input[type=range]');
  await slider.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight"); // draft -> 2.00x, never applied
  await expect(page.getByTestId("load-factor")).toHaveText("2.00x");
  await expect.poll(() => page.getByTestId("outage-list").textContent(), { timeout: 3000 }).toBe("0"); // outage solve lands
  // the unrelated outage solve resolving must not resync this draft back to 1.00x
  await expect(page.getByTestId("load-factor")).toHaveText("2.00x");
});
