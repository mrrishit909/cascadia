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

test("D2/topology/N1 proof: adding candidate line 0 turns an infeasible bus-26 removal into a feasible one", async ({ page }) => {
  // Candidate 0's own note (candidate_lines.json) claims it re-ties the pocket bus 26 feeds -- verified
  // directly against the Python oracle: {removed_buses:[26], allow_shed:false} is infeasible without
  // it, optimal with it. Also confirms base() correctly carries addedLines into removeBus's own request
  // and vice versa, and allowShed into this one. This waits for the removal to fully land before adding
  // the line, so it exercises the CONFIRMED-state combination path only, not a genuine D1 race (an
  // in-flight-overlap race would need its own dedicated test, not this one).
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

test("regression: a second SVG click on a candidate while it is genuinely in flight continues removing, doesn't re-add", async ({ page }) => {
  // App.tsx's SVG toggle handler originally read confirmed state.addedLines only, so a second click
  // while the first add's solve was still in flight flipped the direction based on stale (not-yet-
  // applied) state, re-adding the line instead of removing it. Fixed to read the pending-aware value
  // (mirroring AddLine.tsx's own `eff` computation).
  //
  // NetworkView's data-added attribute is driven by CONFIRMED state.addedLines only (not pending), so
  // it reads "false" for the entire duration of the first in-flight solve regardless of this bug --
  // asserting on it mid-flight is vacuous (an earlier version of this test did exactly that and passed
  // even against the pre-fix handler, verified directly: a stale `reuseExistingServer: true` preview
  // process had silently served old dist during that run). Check the final PROVENANCE label instead,
  // which reveals which direction the second request actually submitted.
  await withWasmDelay(page, 1500);
  await page.goto("/");
  const svgLine = page.locator('[data-testid="candidate-line"][data-candidate="0"]');
  await svgLine.focus();
  await page.keyboard.press("Enter"); // add, solve in flight (~1.5s)
  await page.waitForTimeout(300); // still solving; data-added is still "false" here regardless of the bug
  await svgLine.focus();
  await page.keyboard.press("Enter"); // intent: remove (it's already "added" from the user's perspective)
  await expect(page.locator(".provenance")).toContainText("candidate line 0 removed", { timeout: 5000 });
  await expect(svgLine).toHaveAttribute("data-added", "false");
});
