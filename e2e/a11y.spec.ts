// axe-core accessibility audit against the real production build, baseline state (CAS-RELEASE-001 /
// the parent portfolio directive's "axe-core clean" professional-quality bar). Complements Lighthouse's
// accessibility score (98/100 baseline, verification/PERFORMANCE/lighthouse_baseline_2026-10-09.json),
// which only runs a subset of axe's own ruleset.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("axe-core: baseline page has zero violations", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".provenance");
  const results = await new AxeBuilder({ page }).analyze();
  if (results.violations.length) {
    console.log(JSON.stringify(results.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })), null, 1));
  }
  expect(results.violations).toEqual([]);
});

// Architecture-stabilization regression: RemoveNode/AlterCapacity/ScenarioReadout used to each carry
// their own role="status"/role="alert" element, so a single solve fired up to 6 duplicate screen-reader
// announcements. StatusRegion/RestorationStatusRegion (App.tsx) are now the ONLY live-announcing
// elements: exactly one for the main scenario subsystem, plus a second once restoration has run.
test("exactly one live region announces the main scenario; a second appears only once restoration runs", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".provenance");
  const liveRegions = () => page.locator('[role="status"], [role="alert"]');
  await expect(liveRegions()).toHaveCount(1);
  await page.getByRole("button", { name: "Compare" }).click();
  await expect(liveRegions()).toHaveCount(2, { timeout: 5000 });
});
