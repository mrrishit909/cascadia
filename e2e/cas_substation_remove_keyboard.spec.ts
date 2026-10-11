import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { home } from "./helpers/placement";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

// CAS-INT-001 keyboard-only: no pointer/mouse calls anywhere in this file.
test("remove a substation by keyboard; unserved MW equals sweep total_shed", async ({ page, browserName }) => {
  // macOS WebKit never Tabs to buttons (the OS "keyboard navigation" setting, off by default), so
  // the Tab-to-Confirm step can't run there; Linux WebKit (CI) and every other engine run it.
  test.skip(browserName === "webkit" && process.platform === "darwin", "macOS WebKit does not Tab to buttons");
  const sweep = JSON.parse(fs.readFileSync(path.join(ROOT, "verification/REFERENCE_RESULTS/n1_sweep.json"), "utf8"));
  const c = sweep.cases.find((x: any) => x.scenario?.removed_buses?.length === 1 && x.status === "optimal" && x.total_shed > 0);
  expect(c, "sweep has a bus removal with nonzero shed").toBeTruthy();
  const bus: number = c.scenario.removed_buses[0];
  const expected = `${c.total_shed.toFixed(2)} MW`; // UI formats with toFixed(2)

  await page.goto("/");
  // Chapter-shell roving tabindex (e2e/networkRovingTabindex.spec.ts has the dedicated Arrow-key
  // coverage for the mechanism itself): only ONE bus/line is ever a Tab stop now, so Tabbing up to 200
  // times to reach an ARBITRARY bus (this test's target is picked dynamically from sweep data, not a
  // fixed id near the default roving position) is no longer the right tool -- the same `.focus()`
  // instrumentation already used throughout this suite's other "keyboard-only" tests (e.g.
  // concurrency.spec.ts, addLine.spec.ts) to reach a starting element is used here too; the real
  // keyboard interaction this test verifies is everything AFTER focus lands (Enter to select, Tab/Enter
  // to confirm), unchanged.
  const target = page.locator(`[data-testid="bus"][data-bus="${bus}"]`);
  await expect(target).toBeVisible();
  await target.focus();
  await expect(target).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(target).toHaveAttribute("aria-pressed", "true");

  // Tab to Confirm removal.
  for (let i = 0; i < 200 && !(await home(page).getByRole("button", { name: "Confirm removal" }).evaluate(el => el === document.activeElement)); i++) await page.keyboard.press("Tab");
  const confirm = home(page).getByRole("button", { name: "Confirm removal" });
  await expect(confirm).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(home(page).getByTestId("unserved-mw")).toHaveText(expected);
  // The committed evidence is Chromium's; other engines keep their screenshot in test-results.
  const dir = test.info().project.name === "chromium" ? path.join(ROOT, "verification/SCREENSHOTS") : test.info().outputDir;
  await page.screenshot({ path: path.join(dir, "cas-int-001-keyboard-remove.png"), fullPage: true });
});
