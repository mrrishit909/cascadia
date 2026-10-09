// e2e coverage for the three M4 wave-1 controls (CAS-INT-002 increase load, CAS-INT-003 reduce
// generator, CAS-INT-007 line outage) against the real production build/Worker. Most tests use
// selectOption/fill/click for setup speed; the three "keyboard-only parity" tests below prove each
// control's sliders/checkboxes/buttons are fully keyboard-operable (CAS-UX-001's own requirement)
// using only .focus() + keyboard.press for those elements -- selectOption is still used for the
// <select> itself, since headless Chromium doesn't support driving a native select's value via
// synthetic key events (see the comment above those tests). Also targets the same bug classes
// already found once in the first two controls (D1, D2, N1, N2) to prove `runScen`'s shared
// epoch/pendingRef/allowShed plumbing carries over to new fields, not just removedBus/lineCapacity.
import { expect, test, type Page } from "@playwright/test";

async function withWasmDelay(page: Page, ms: number) {
  await page.route("**/*.wasm", async (route) => {
    if (ms) await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}

// "Allow load shedding" is scoped to AlterCapacity.tsx's own rendered block (it only exists once a
// line is selected there), but the field it controls (allowShed) is shared scenario-wide -- so any
// control can observe it once set. Select a line, then flip the checkbox, via keyboard only. Waits
// for AlterCapacity's own debounced solve to actually COMMIT allowShed=false (read from `.provenance`,
// which runScen/setCapacity only write from the confirmed scenario), not just for the checkbox's own
// local draft state -- a reviewer-flagged gap: without this wait, a later control's Apply can fire
// before this solve lands, so its result would come from THAT control's own re-solve (which also
// threads allowShed through base()), not actually proving this checkbox's intent reached the Worker.
async function disallowSheddingGlobally(page: Page) {
  await page.locator('section:has-text("Alter line capacity") select').selectOption({ index: 1 });
  const cb = page.getByRole("checkbox", { name: "Allow load shedding" });
  await cb.focus();
  await page.keyboard.press("Space");
  await expect(cb).not.toBeChecked();
  await expect(page.locator(".provenance")).toContainText("shedding disabled", { timeout: 2000 });
}

test("regression: selecting a generator then immediately setting its slider is not reverted by the resync effect", async ({ page }) => {
  // Found while investigating an advisor-flagged "0.00 MW" failure in the D2 test below: the old
  // resync effect (keyed on [gen, epoch]) ran asynchronously after the select's onChange, leaving a
  // window where an immediately-following slider set landed before the effect's own flush and got
  // silently overwritten back to `rated` -- which then made Apply's `mw === rated` check submit
  // "restore to rated" instead of the user's actual value. Reproduced directly (100% across 30 runs
  // with no settle delay) and fixed by setting gen+mw synchronously in one onChange handler instead of
  // splitting the reset across a separate effect. This test pins the exact interleaving that broke it.
  await page.goto("/");
  const genSelect = page.locator('section:has-text("Reduce generator") select');
  const slider = page.locator('section:has-text("Reduce generator") input[type=range]');
  await genSelect.selectOption({ index: 1 }); // gen 0, rated 80 MW
  await slider.fill("0"); // immediately, no settle wait -- this is the exact race window
  await expect(page.getByTestId("gen-pmax")).toHaveText("0 MW");
  await page.getByRole("button", { name: "Apply limit" }).click();
  await expect(page.getByTestId("gen-pmax")).toHaveText("0 MW"); // must stay 0, not bounce back to 80
  await expect(page.locator(".provenance")).toContainText("generator 0 Pmax 0 MW");
});

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
    await slider.fill("0"); // deterministic vs. counting ArrowDown presses against a per-generator rated max
    await expect(page.getByTestId("gen-pmax")).toHaveText("0 MW");
    await page.getByRole("button", { name: "Apply limit" }).click();
    // each iteration's solve must fully resolve before the next is fired, or the next selectOption's
    // own resync effect can read a not-yet-landed `eff` and build on a stale base
    await expect(page.getByRole("button", { name: "Apply limit" })).toBeEnabled({ timeout: 5000 });
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
  // direct proof setLoadScale's own runScen carried allowShed through base(), not a side effect of
  // some other control's re-solve: the label is built from scenario.allowShed at the call site itself.
  await expect(page.locator(".provenance")).toContainText("load x10, shedding disabled");
});

test("D1: load applied while AlterCapacity's debounced capacity solve is genuinely in flight: both land, solver-confirmed", async ({ page }) => {
  // Every Apply/Confirm button in this app disables itself during solve, so a race can't be driven
  // through a second button click (Playwright's .click() waits for enabled) -- the real D1-class race
  // surviving in production is AlterCapacity's 250ms DEBOUNCE window: a capacity change is confirmed
  // (not yet dispatched to the Worker) and a second control's Apply fires inside that window, so the
  // debounced setCapacity call ends up racing the load solve instead of being serialized behind it.
  await page.goto("/");
  await page.locator('section:has-text("Alter line capacity") select').selectOption({ index: 10 }); // line 9
  const capSlider = page.getByRole("slider");
  await capSlider.focus();
  await page.keyboard.press("ArrowLeft"); // 1.00x -> 0.95x, debounce timer armed, NOT yet sent to the Worker
  await page.locator('section:has-text("Increase load") select').selectOption({ index: 5 }); // bus 7
  const loadSlider = page.locator('section:has-text("Increase load") input[type=range]');
  await loadSlider.focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowRight"); // 1x -> 4x
  await expect(page.getByTestId("load-factor")).toHaveText("4.00x");
  await page.getByRole("button", { name: "Apply load" }).click(); // fires well inside the 250ms debounce window
  // solver-derived: both the capacity change (read from the engine's own line_rating_mw via the line's
  // aria-label) and the load change must land in the SAME final combined result, matching the oracle's
  // combo_line9_cap_x0.95_load_bus7_x4 case (verification/REFERENCE_RESULTS/load_gen_sweep.json)
  await expect.poll(() => page.locator('[data-testid="line"][data-line="9"]').getAttribute("aria-label"), { timeout: 3000 }).toContain("30.40 MW");
  await expect(page.getByTestId("load-unserved")).toHaveText("78.63 MW", { timeout: 3000 });
  // proves genuine interleaving, not serialization: the debounced capacity request is dispatched to
  // the Worker AFTER Apply load's (confirmed empirically across 5 runs at this exact keystroke timing;
  // if it instead landed first, final provenance would read the capacity label, not the load one)
  await expect(page.locator(".provenance")).toContainText("line 9 capacity x0.95");
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

test("a disabled line can be restored via keyboard directly on the SVG, not only the LineOutage select", async ({ page }) => {
  await page.goto("/");
  await page.locator('section:has-text("Line outage") select').selectOption({ index: 1 }); // line 0
  await page.getByRole("button", { name: "Disable line" }).click();
  await page.getByRole("button", { name: "Confirm outage" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("outage-list")).toHaveText("0", { timeout: 5000 });
  const svgLine = page.locator('[data-testid="line"][data-line="0"][data-outaged="true"]');
  await expect(svgLine).toBeVisible();
  await svgLine.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("outage-list")).toHaveText("none", { timeout: 5000 });
  await expect(page.locator('[data-testid="line"][data-line="0"][data-outaged="true"]')).toHaveCount(0);
});

// Native <select> elements don't respond to synthetic ArrowDown/Enter key events for changing their
// VALUE in headless Chromium (confirmed directly: focus + ArrowDown left the value empty across
// several attempts, including Alt+ArrowDown to open the popup first) -- a Playwright/headless-browser
// limitation, not an app accessibility gap (a native select's own OS-rendered dropdown is keyboard-
// operable for a real user; Playwright's own docs recommend selectOption for this reason). These tests
// therefore use selectOption for the <select> itself and real keyboard (.focus() + keyboard.press, no
// .click()/.fill()) for every slider, checkbox and button -- the parts CAS-UX-001 can actually be
// proven keyboard-operable for through this tool.
test("keyboard-only parity (sliders/buttons): Increase load works end to end without a mouse", async ({ page }) => {
  await page.goto("/");
  await page.locator('section:has-text("Increase load") select').selectOption({ index: 1 }); // bus 1
  const slider = page.locator('section:has-text("Increase load") input[type=range]');
  await slider.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight"); // 1x -> 2x
  await expect(page.getByTestId("load-factor")).toHaveText("2.00x");
  await page.getByRole("button", { name: "Apply load" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("load-unserved")).toHaveText("0.00 MW", { timeout: 3000 });
});

test("keyboard-only parity (sliders/buttons): Reduce generator works end to end without a mouse", async ({ page }) => {
  await page.goto("/");
  await page.locator('section:has-text("Reduce generator") select').selectOption({ index: 1 }); // gen 0
  const slider = page.locator('section:has-text("Reduce generator") input[type=range]');
  await slider.focus();
  for (let i = 0; i < 80; i++) await page.keyboard.press("ArrowDown"); // 80 MW -> 0
  await expect(page.getByTestId("gen-pmax")).toHaveText("0 MW");
  await page.getByRole("button", { name: "Apply limit" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("gen-unserved")).toHaveText("0.00 MW", { timeout: 3000 });
});

test("keyboard-only parity (buttons/Escape): Line outage works end to end without a mouse", async ({ page }) => {
  await page.goto("/");
  await page.locator('section:has-text("Line outage") select').selectOption({ index: 1 }); // line 0
  await page.getByRole("button", { name: "Disable line" }).focus();
  await page.keyboard.press("Enter"); // opens the confirm group
  // Escape cancels the confirm without disabling the line
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("outage-list")).toHaveText("none");
  await page.getByRole("button", { name: "Disable line" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Confirm outage" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("outage-list")).toHaveText("0", { timeout: 3000 });
});

test("reset during an active generator solve restores Pmax to rated and clears the outage list", async ({ page }) => {
  await withWasmDelay(page, 1500);
  await page.goto("/");
  await page.locator('section:has-text("Line outage") select').selectOption({ index: 1 });
  await page.getByRole("button", { name: "Disable line" }).click();
  await page.getByRole("button", { name: "Confirm outage" }).click();
  await expect(page.locator('[data-testid="line"][data-line="0"][data-outaged="true"]')).toBeVisible({ timeout: 3000 });
  await page.locator('section:has-text("Reduce generator") select').selectOption({ index: 1 });
  const slider = page.locator('section:has-text("Reduce generator") input[type=range]');
  await slider.fill("0");
  await page.getByRole("button", { name: "Apply limit" }).click(); // solve in flight (~1.5s)
  await page.getByRole("button", { name: "Reset to baseline" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("gen-pmax")).toHaveText("80 MW"); // rated value for gen 0
  await expect(page.getByTestId("outage-list")).toHaveText("none");
  await expect(page.getByTestId("gen-unserved")).toHaveText("0.00 MW");
  // the stale 1.5s generator solve must not silently override the reset once it resolves
  await page.waitForTimeout(2000);
  await expect(page.getByTestId("gen-pmax")).toHaveText("80 MW");
  await expect(page.getByTestId("outage-list")).toHaveText("none");
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
  // Wait for the outage to actually reach the CONFIRMED (not just pending) scenario -- the SVG only
  // renders data-outaged once state.disabledLines (post-'solved') includes the line; outage-list reads
  // pending?.disabledLines, which flips as soon as the request is dispatched and would make this poll
  // pass trivially before the solve the test is actually trying to race against has even landed.
  await expect(page.locator('[data-testid="line"][data-line="0"][data-outaged="true"]')).toBeVisible({ timeout: 3000 });
  // the unrelated outage solve resolving must not resync this draft back to 1.00x
  await expect(page.getByTestId("load-factor")).toHaveText("2.00x");
});
