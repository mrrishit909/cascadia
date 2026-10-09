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

test("regression: generator Pmax reductions survive a rapid select+slider loop under load, real keyboard", async ({ page }) => {
  // Found while investigating an advisor-flagged "0.00 MW" failure in the D2 test below: the old
  // resync effect (keyed on [gen, epoch]) ran asynchronously after the select's onChange, leaving a
  // window where an immediately-following slider set could land before the effect's own flush and get
  // silently overwritten back to `rated` -- which then made Apply's `mw === rated` check submit
  // "restore to rated" instead of the user's actual value.
  //
  // A simpler single-generator version of this test (select once, set once, Apply once) was found by
  // an advisor review to pass even on the pre-fix code -- it never actually exercised the race. This
  // version, with the .provenance watch below (added after a second review found the final-infeasible
  // check alone could still pass with one reduction silently lost), was verified BOTH ways: run against
  // the pre-fix component with real keyboard input (focus + Home, never .fill()), 20/20 repeat-each
  // runs FAILED (the .provenance watch caught "Pmax rated" every time); against the fixed component,
  // 20/20 passed. An earlier looser probe using just the final "n/a (infeasible)" check (no .provenance
  // watch) only failed 3/10 times against pre-fix code with this same real-keyboard shape -- consistent
  // with losing a single reduction usually still reading as infeasible, which is exactly why that
  // weaker check was replaced. The checkbox's own debounced solve (AlterCapacity) running concurrently
  // during the loop is what perturbs the timing enough to hit the window at all; the single-generator
  // case (no checkbox) didn't reproduce it, which is why this test keeps that interaction.
  await page.goto("/");
  await page.waitForSelector(".provenance");
  // "n/a (infeasible)" alone is a weak final assertion: gens 0/1/2/3 total 265 MW against a 189.2 MW
  // load, so losing any ONE of the four reductions still leaves well under 189.2 MW of capacity and
  // still reads as infeasible -- the test could pass with a reduction silently lost. Watch .provenance
  // directly instead and fail on ANY entry showing "Pmax rated" (the smoking-gun string Apply submits
  // when the slider value was reverted before the click).
  await page.evaluate(() => {
    (window as unknown as { __prov: string[] }).__prov = []
    const target = document.querySelector('.provenance') as Element
    new MutationObserver(() => (window as unknown as { __prov: string[] }).__prov.push(target.textContent ?? '')).observe(target, { characterData: true, childList: true, subtree: true })
  });
  await page.locator('section:has-text("Alter line capacity") select').selectOption({ index: 1 });
  const cb = page.getByRole("checkbox", { name: "Allow load shedding" });
  await cb.focus();
  await page.keyboard.press("Space"); // deliberately NOT waiting for this to commit -- that's the perturbation
  const genSelect = page.locator('section:has-text("Reduce generator") select');
  const slider = page.locator('section:has-text("Reduce generator") input[type=range]');
  for (let idx = 1; idx <= 4; idx++) {
    await genSelect.selectOption({ index: idx });
    await slider.focus();
    await page.keyboard.press("Home"); // real keyboard, sets range to its min (0) -- never .fill()
    await page.getByRole("button", { name: "Apply limit" }).click();
  }
  await expect(page.getByTestId("gen-unserved")).toHaveText("n/a (infeasible)", { timeout: 5000 });
  const prov = await page.evaluate(() => (window as unknown as { __prov: string[] }).__prov);
  expect(prov.some((p) => p.includes('Pmax rated'))).toBe(false);
});

test("N1/D2 for line outage: disabling line 33 with 'Allow load shedding' off shows n/a (infeasible)", async ({ page }) => {
  // Direct proof setLineOutage's own runScen carried allowShed through base() (the INT-007 note
  // previously claimed this without a dedicated test -- only the N2 trigger and SVG-restore test
  // touched this control at all). Line 33's outage is infeasible with shedding disallowed and optimal
  // with it allowed (verified against the Python oracle directly), so this also doubles as a D2 check
  // for this control specifically.
  await page.goto("/");
  await disallowSheddingGlobally(page);
  await page.locator('section:has-text("Line outage") select').selectOption({ index: 34 }); // line 33
  await page.getByRole("button", { name: "Disable line" }).click();
  await page.getByRole("button", { name: "Confirm outage" }).click();
  await expect(page.getByTestId("outage-unserved")).toHaveText("n/a (infeasible)", { timeout: 5000 });
  await expect(page.locator(".provenance")).toContainText("line 33 outage, shedding disabled");
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

test("D1: AlterCapacity's debounced request fires while the load solve is genuinely in flight: both land, solver-confirmed", async ({ page }) => {
  // Every Apply/Confirm button in this app disables itself during solve, so a race can't be driven
  // through a second button click (Playwright's .click() waits for enabled) -- the real D1-class race
  // surviving in production is AlterCapacity's 250ms DEBOUNCE window: a capacity change is confirmed
  // (armed, not yet dispatched to the Worker), then Apply load fires the page's first actual solve()
  // call, which the WASM delay below stretches to ~1500ms. The capacity debounce timer elapses DURING
  // that window and dispatches its own request to the same Worker while the load solve is still in
  // flight -- the request ordering is the reverse of what an earlier version of this test's name
  // implied (it is NOT the capacity solve that's in flight when load applies; it's the other way
  // round). Confirmed by direct measurement (a .provenance MutationObserver, 5/5 runs): the load
  // result lands first, the capacity result lands second, even with no WASM delay at this test's exact
  // keystroke count -- the delay below just makes that ordering deterministic across machines/CI
  // rather than depending on keystroke timing.
  await withWasmDelay(page, 1500);
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
  // Architecture-stabilization pass: reset now clears the bus SELECTION too (shared AppState.loadDraft
  // -> {bus: null, f: 1}), not just the slider's value as it did when bus/f were local component state
  // -- a deliberate behavior change (full reset == start fresh), not a regression: a stale selection
  // left showing a draft value after reset would be the exact N2 bug class this test exists to catch,
  // and "no selection at all" is a strictly stronger guarantee against that than "selection kept, value
  // resynced" was.
  await expect(page.locator('section:has-text("Increase load") select')).toHaveValue("");
  await expect(page.getByTestId("load-factor")).toHaveCount(0);
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
  // focus must return to "Disable line" itself after Escape -- not re-focused by the test, which would
  // hide the same focus-drops-to-body bug this fix addresses (confirmed before the fix: Escape here did
  // nothing because the event never reached the section's onKeyDown from <body>)
  await expect(page.getByRole("button", { name: "Disable line" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Confirm outage" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("outage-list")).toHaveText("0", { timeout: 3000 });
});

test("regression: focus returns to 'Restore line' after Confirm outage's solve settles, not dropped to body", async ({ page }) => {
  // Confirm's click handler leaves `confirming` and starts a solve in the same batch, so the trigger
  // button re-renders disabled at the exact moment the naive version of this fix tried to focus it --
  // .focus() on a disabled element is a silent no-op. Add a real WASM delay so there's a window where
  // the trigger is genuinely disabled to prove the deferred-focus path (awaitingTriggerFocus), not just
  // the already-enabled case covered by the test above.
  await withWasmDelay(page, 1500);
  await page.goto("/");
  await page.locator('section:has-text("Line outage") select').selectOption({ index: 1 });
  await page.getByRole("button", { name: "Disable line" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Confirm outage" }).focus();
  await page.keyboard.press("Enter"); // solve in flight (~1.5s); trigger button re-renders disabled now
  await expect(page.getByRole("button", { name: "Restore line" })).toBeFocused({ timeout: 3000 });
});

test("reset during an active generator solve restores Pmax to rated", async ({ page }) => {
  // The gen solve must be the FIRST solve of the page load for the WASM delay to actually stall it --
  // it only applies to the one-time WASM fetch, not to every subsequent solve. An earlier version of
  // this test ran an outage first (and waited it out), so by the time the gen solve started the WASM
  // module was already loaded and it resolved near-instantly, never actually racing the reset.
  await withWasmDelay(page, 1500);
  await page.goto("/");
  await page.locator('section:has-text("Reduce generator") select').selectOption({ index: 1 });
  const slider = page.locator('section:has-text("Reduce generator") input[type=range]');
  await slider.fill("0");
  await page.getByRole("button", { name: "Apply limit" }).click(); // solve in flight (~1.5s, the page's first solve)
  await expect(page.getByRole("button", { name: "Apply limit" })).toBeDisabled();
  await page.getByRole("button", { name: "Reset to baseline" }).focus();
  await page.keyboard.press("Enter");
  // Architecture-stabilization pass: reset now clears the generator SELECTION too (shared
  // AppState.genDraft -> {gen: null, mw: 0}), not just the slider's value -- see the matching note on
  // the "Reset restores..." test above for why this is a deliberate, stronger guarantee, not a regression.
  await expect(page.locator('section:has-text("Reduce generator") select')).toHaveValue("");
  await expect(page.getByTestId("gen-pmax")).toHaveCount(0);
  await expect(page.getByTestId("gen-unserved")).toHaveText("0.00 MW");
  // the stale 1.5s generator solve must not silently override the reset once it resolves
  await page.waitForTimeout(2000);
  await expect(page.locator('section:has-text("Reduce generator") select')).toHaveValue("");
  await expect(page.getByTestId("gen-unserved")).toHaveText("0.00 MW");
});

test("reset during an active line-outage solve clears the outage list", async ({ page }) => {
  await withWasmDelay(page, 1500);
  await page.goto("/");
  await page.locator('section:has-text("Line outage") select').selectOption({ index: 1 });
  await page.getByRole("button", { name: "Disable line" }).click();
  await page.getByRole("button", { name: "Confirm outage" }).click(); // solve in flight (~1.5s, the page's first solve)
  await expect(page.getByRole("button", { name: "Confirm outage" })).toHaveCount(0); // confirm UI already dismissed
  await page.getByRole("button", { name: "Reset to baseline" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("outage-list")).toHaveText("none");
  await expect(page.locator('[data-testid="line"][data-line="0"][data-outaged="true"]')).toHaveCount(0);
  // the stale 1.5s outage solve must not silently re-apply the outage once it resolves
  await page.waitForTimeout(2000);
  await expect(page.getByTestId("outage-list")).toHaveText("none");
  await expect(page.locator('[data-testid="line"][data-line="0"][data-outaged="true"]')).toHaveCount(0);
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

test("N2 regression: an unrelated control's solve does not wipe an uncommitted generator-slider draft", async ({ page }) => {
  // Same gap as above, for ReduceGenerator specifically -- the advisor review's own checklist flagged
  // that INT-003's N2 claim had no dedicated test for ITS draft (IncreaseLoad shares the component
  // pattern, but a shared pattern fixed in one file isn't proof the other file's copy is also correct).
  await withWasmDelay(page, 800);
  await page.goto("/");
  await page.locator('section:has-text("Line outage") select').selectOption({ index: 1 });
  await page.getByRole("button", { name: "Disable line" }).click();
  await page.getByRole("button", { name: "Confirm outage" }).focus();
  await page.keyboard.press("Enter");
  await page.locator('section:has-text("Reduce generator") select').selectOption({ index: 1 });
  const slider = page.locator('section:has-text("Reduce generator") input[type=range]');
  await slider.fill("10"); // draft -> 10 MW, never applied
  await expect(page.getByTestId("gen-pmax")).toHaveText("10 MW");
  await expect(page.locator('[data-testid="line"][data-line="0"][data-outaged="true"]')).toBeVisible({ timeout: 3000 });
  // the unrelated outage solve resolving must not resync this draft back to 80 MW (rated)
  await expect(page.getByTestId("gen-pmax")).toHaveText("10 MW");
});
