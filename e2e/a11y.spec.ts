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
