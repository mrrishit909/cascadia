// e2e coverage for CAS-INT-004 (add line), against the real production build/Worker. AddLine.tsx has
// no <select> (plain buttons, one per candidate), so every test here IS fully keyboard-only (no tool
// limitation to work around, unlike the select-driven controls in newControls.spec.ts).
import { expect, test, type Page } from "@playwright/test";

async function withWasmDelay(page: Page, ms: number) {
  await page.route("**/*.wasm", async (route) => {
    if (ms) await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}

test("adding candidate line 0 computes a real flow, matching the Python oracle", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add line 0" }).focus();
  await page.keyboard.press("Enter");
  // solver-derived, verified against the Python oracle directly (0.0517 MW, slack, not binding)
  await expect.poll(() => page.locator('[data-testid="candidate-line"][data-candidate="0"]').getAttribute("aria-label"), { timeout: 3000 })
    .toContain("0.05 of 32.00 MW");
  await expect(page.locator(".provenance")).toContainText("candidate line 0 added");
});

test("a line added via the control can be removed directly from the SVG, keyboard-only", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add line 0" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-testid="candidate-line"][data-candidate="0"]')).toHaveAttribute("data-added", "true", { timeout: 3000 });
  await page.locator('[data-testid="candidate-line"][data-candidate="0"]').focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-testid="candidate-line"][data-candidate="0"]')).toHaveAttribute("data-added", "false", { timeout: 3000 });
  await expect(page.locator(".provenance")).toContainText("candidate line 0 removed");
});

test("D2/topology proof: adding candidate line 0 turns an infeasible bus-26 removal into a feasible one", async ({ page }) => {
  // Candidate 0's own note (candidate_lines.json) claims it re-ties the pocket bus 26 feeds -- verified
  // directly against the Python oracle: {removed_buses:[26], allow_shed:false} is infeasible without
  // it, optimal with it. Also exercises D1 (removeBus's own request must still see addedLines via
  // base(), and vice versa) since this combines two different controls' state in one scenario.
  await page.goto("/");
  await page.locator('section:has-text("Alter line capacity") select').selectOption({ index: 1 });
  const cb = page.getByRole("checkbox", { name: "Allow load shedding" });
  await cb.focus();
  await page.keyboard.press("Space");
  await expect(cb).not.toBeChecked();
  await page.locator('[data-testid="bus"][data-bus="26"]').focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Confirm removal" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("unserved-mw")).toHaveText("n/a (infeasible)", { timeout: 5000 });
  await page.getByRole("button", { name: "Add line 0" }).focus();
  await page.keyboard.press("Enter"); // this request must carry the still-active bus-26 removal (D1/base())
  await expect(page.getByTestId("unserved-mw")).not.toHaveText("n/a (infeasible)", { timeout: 5000 });
  await expect(page.locator('[data-testid="bus"][data-bus="26"]')).toHaveAttribute("data-state", "removed"); // removal itself still applied
});

test("N1: adding a line respects the current 'Allow load shedding' setting, not the engine default", async ({ page }) => {
  await page.goto("/");
  await page.locator('section:has-text("Alter line capacity") select').selectOption({ index: 1 });
  const cb = page.getByRole("checkbox", { name: "Allow load shedding" });
  await cb.focus();
  await page.keyboard.press("Space");
  await expect(cb).not.toBeChecked();
  await expect(page.locator(".provenance")).toContainText("shedding disabled", { timeout: 2000 });
  await page.getByRole("button", { name: "Add line 0" }).focus();
  await page.keyboard.press("Enter");
  // base() must carry allowShed=false into this request too -- if N1 regressed here, the label
  // below would read "candidate line 0 added" with no "shedding disabled" suffix
  await expect(page.locator(".provenance")).toContainText("candidate line 0 added, shedding disabled", { timeout: 3000 });
});

test("reset during an active add-line solve restores no-candidates-added", async ({ page }) => {
  await withWasmDelay(page, 1500);
  await page.goto("/");
  const toggleBtn = page.locator('section:has-text("Add transmission line") li:has-text("line 0:") button');
  await toggleBtn.focus();
  await page.keyboard.press("Enter"); // solve in flight (~1.5s, the page's first solve); label flips to "Remove" optimistically
  await expect(toggleBtn).toBeDisabled();
  await page.getByRole("button", { name: "Reset to baseline" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-testid="candidate-line"][data-candidate="0"]')).toHaveAttribute("data-added", "false");
  // the stale 1.5s solve must not silently re-add the line once it resolves
  await page.waitForTimeout(2000);
  await expect(page.locator('[data-testid="candidate-line"][data-candidate="0"]')).toHaveAttribute("data-added", "false");
});

test("N2-class check: an unrelated control's solve does not retroactively change an already-added line's display", async ({ page }) => {
  // AddLine has no local draft state to resync (unlike the slider controls), so the N2 bug class
  // doesn't directly apply here -- this instead checks that an unrelated solve's result doesn't
  // somehow clear addedLines, which would be a different instance of "lost confirmed intent".
  await withWasmDelay(page, 800);
  await page.goto("/");
  await page.getByRole("button", { name: "Add line 0" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-testid="candidate-line"][data-candidate="0"]')).toHaveAttribute("data-added", "true", { timeout: 3000 });
  await page.locator('section:has-text("Line outage") select').selectOption({ index: 1 });
  await page.getByRole("button", { name: "Disable line" }).click();
  await page.getByRole("button", { name: "Confirm outage" }).click();
  await expect(page.locator('[data-testid="line"][data-line="0"][data-outaged="true"]')).toBeVisible({ timeout: 3000 });
  await expect(page.locator('[data-testid="candidate-line"][data-candidate="0"]')).toHaveAttribute("data-added", "true");
});
