import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// CAS-INT-001 keyboard-only: no pointer/mouse calls anywhere in this file.
test("remove a substation by keyboard; unserved MW equals sweep total_shed", async ({ page }) => {
  const sweep = JSON.parse(fs.readFileSync(path.join(ROOT, "verification/REFERENCE_RESULTS/n1_sweep.json"), "utf8"));
  const c = sweep.cases.find((x: any) => x.scenario?.removed_buses?.length === 1 && x.status === "optimal" && x.total_shed > 0);
  expect(c, "sweep has a bus removal with nonzero shed").toBeTruthy();
  const bus: number = c.scenario.removed_buses[0];
  const expected = `${c.total_shed.toFixed(2)} MW`; // UI formats with toFixed(2)

  await page.goto("/");
  // Tab to the SVG bus control for this bus, then Enter selects it for removal.
  const target = page.locator(`[data-testid="bus"][data-bus="${bus}"]`);
  await expect(target).toBeVisible();
  for (let i = 0; i < 200 && !(await target.evaluate(el => el === document.activeElement)); i++) await page.keyboard.press("Tab");
  await expect(target).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(target).toHaveAttribute("aria-pressed", "true");

  // Tab to Confirm removal.
  for (let i = 0; i < 200 && !(await page.getByRole("button", { name: "Confirm removal" }).evaluate(el => el === document.activeElement)); i++) await page.keyboard.press("Tab");
  const confirm = page.getByRole("button", { name: "Confirm removal" });
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.getByTestId("unserved-mw")).toHaveText(expected);
  await page.screenshot({ path: path.join(ROOT, "verification/SCREENSHOTS", "cas-int-001-keyboard-remove.png"), fullPage: true });
});
