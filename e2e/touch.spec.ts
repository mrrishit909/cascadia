// Touch/tap e2e coverage (CAS-UX-001 requires touch parity; this was a documented gap with zero
// coverage until now). Uses a real touch-emulated context (hasTouch: true) at the mobile breakpoint
// (390x844) and .tap() exclusively -- never .click() -- against the real production build/Worker.
import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test("touch: remove a substation via tap on the SVG, confirm via tap", async ({ page }) => {
  // Tap the inner <circle>, not the outer <g data-testid="bus">: the <g>'s bounding box includes its
  // text label (rendered 15px above the circle), so Playwright's default bbox-center tap point lands
  // between the label and the circle, missing both -- confirmed NOT a real rendering/z-order bug (a
  // real finger tapping the visible circle on a phone hits it correctly; elementFromPoint at the
  // circle's own actual center resolves to the bus, not an overlapping line).
  await page.goto("/");
  await page.locator('[data-testid="bus"][data-bus="26"] circle').first().tap();
  await page.getByRole("button", { name: "Confirm removal" }).tap();
  await expect(page.locator('[data-testid="bus"][data-bus="26"]')).toHaveAttribute("data-state", "removed", { timeout: 5000 });
  await expect(page.getByTestId("unserved-mw")).toHaveText("13.00 MW");
});

test("touch: alter line capacity via tap on the SVG then drag the slider", async ({ page }) => {
  await page.goto("/");
  await page.locator('[data-testid="line"][data-line="9"]').tap();
  const slider = page.locator('section:has-text("Alter line capacity") input[type=range]');
  await expect(slider).toBeVisible({ timeout: 3000 }); // confirms the tap actually selected line 9 (slider only renders once a line is selected)
  await slider.tap();
  // Confirmed by direct investigation: in a touch-emulated (hasTouch/isMobile) Playwright context,
  // ArrowLeft on a focused range input does NOT change its value, even though the identical
  // focus()+ArrowLeft sequence works in every non-touch e2e test in this suite -- a touch-context
  // quirk in Chromium/Playwright's keyboard-event handling for range inputs, not an app bug (the
  // input genuinely receives focus; confirmed via document.activeElement). A real touch drag gesture
  // on the slider thumb isn't simulable via Playwright's tap() either. .fill() still proves the
  // tap-to-select-the-line path works on a touch device and that the resulting value change reaches
  // the real Worker solve end to end -- it just can't exercise the drag gesture itself here.
  await slider.fill("0.95");
  await expect(page.getByTestId("cap-factor")).toHaveText("0.95x", { timeout: 3000 });
});

test("touch: add a candidate line via tap on its own button", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add line 0" }).tap();
  await expect.poll(() => page.locator('[data-testid="candidate-line"][data-candidate="0"]').getAttribute("data-added"), { timeout: 3000 }).toBe("true");
});

test("touch: compare restoration via tap (select preset, tap Compare, tap an order)", async ({ page }) => {
  await page.goto("/");
  await page.locator('section:has-text("Compare restoration") select').selectOption("two_buses");
  await page.getByRole("button", { name: "Compare" }).tap();
  await expect(page.getByTestId("cr-n-orders")).toHaveText("2", { timeout: 5000 });
  const rows = page.locator('section:has-text("Compare restoration") li button');
  await rows.nth(1).tap();
  await expect(page.getByTestId("cr-chosen-rank")).toHaveText("2");
});

test("touch: line outage disable+confirm, then restore directly from the SVG via tap", async ({ page }) => {
  await page.goto("/");
  await page.locator('section:has-text("Line outage") select').selectOption({ index: 1 });
  await page.getByRole("button", { name: "Disable line" }).tap();
  await page.getByRole("button", { name: "Confirm outage" }).tap();
  await expect(page.locator('[data-testid="line"][data-line="0"][data-outaged="true"]')).toBeVisible({ timeout: 3000 });
  await page.locator('[data-testid="line"][data-line="0"][data-outaged="true"]').tap();
  await expect(page.getByTestId("outage-list")).toHaveText("none", { timeout: 3000 });
});
