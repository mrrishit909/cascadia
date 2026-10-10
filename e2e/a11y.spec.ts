// axe-core accessibility audit against the real production build, baseline state (CAS-RELEASE-001 /
// the parent portfolio directive's "axe-core clean" professional-quality bar). Complements Lighthouse's
// accessibility score (98/100 baseline, verification/PERFORMANCE/lighthouse_baseline_2026-10-09.json),
// which only runs a subset of axe's own ruleset.
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { controlHome, controlLab, home, scrollToChapter } from "./helpers/placement";

test("axe-core: baseline page has zero violations", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".provenance");
  const results = await new AxeBuilder({ page }).analyze();
  if (results.violations.length) {
    console.log(JSON.stringify(results.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })), null, 1));
  }
  expect(results.violations).toEqual([]);
});

test("axe-core: chapter 3's corridor strip (new decorative SVG rails + real buttons) has zero violations", async ({ page }) => {
  await page.goto("/");
  await scrollToChapter(page, "ch3");
  const results = await new AxeBuilder({ page }).analyze();
  if (results.violations.length) {
    console.log(JSON.stringify(results.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })), null, 1));
  }
  expect(results.violations).toEqual([]);
});

test("axe-core: chapter 4's fault ledger has zero violations", async ({ page }) => {
  await page.goto("/");
  await scrollToChapter(page, "ch4");
  const results = await new AxeBuilder({ page }).analyze();
  if (results.violations.length) {
    console.log(JSON.stringify(results.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })), null, 1));
  }
  expect(results.violations).toEqual([]);
});

test("axe-core: chapter 5's comparison columns (3 mini networks + step chart) have zero violations", async ({ page }) => {
  await page.goto("/");
  await scrollToChapter(page, "ch5");
  await controlHome(page, "Compare restoration").getByRole("button", { name: "Compare" }).click();
  await expect(page.locator('[data-testid="ch5-column"]')).toHaveCount(3, { timeout: 5000 });
  const results = await new AxeBuilder({ page }).analyze();
  if (results.violations.length) {
    console.log(JSON.stringify(results.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })), null, 1));
  }
  expect(results.violations).toEqual([]);
});

test("axe-core: chapter 6's scenario laboratory (all 7 controls dual-mounted) has zero violations", async ({ page }) => {
  await page.goto("/");
  await scrollToChapter(page, "ch6");
  const results = await new AxeBuilder({ page }).analyze();
  if (results.violations.length) {
    console.log(JSON.stringify(results.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })), null, 1));
  }
  expect(results.violations).toEqual([]);
});

// Architecture-stabilization regression: RemoveNode/AlterCapacity/ScenarioReadout used to each carry
// their own role="status"/role="alert" element, so a single solve fired up to 6 duplicate screen-reader
// announcements. StatusRegion/RestorationStatusRegion (App.tsx) are now the ONLY live-announcing
// elements: two permanently-mounted nodes per subsystem (one role="status", one role="alert"), always
// present so a screen reader can detect the text MUTATION rather than missing a freshly-inserted node
// (a real defect found and fixed in a second advisor-review pass: the first version of this fix
// conditionally mounted/unmounted the live region, which screen readers frequently never announce).
//
// Independent review (P1): this test's own `[role="status"], [role="alert"]` CSS-attribute selector
// only matches EXPLICIT role attributes, so it stayed "4" even after AlterCapacity/IncreaseLoad/
// ReduceGenerator's <output> elements (cap-factor/load-factor/gen-pmax) started duplicating live
// announcements a THIRD way: <output> carries an IMPLICIT role="status" (aria-live="polite") per the
// HTML-AAM spec. Confirmed via Chromium's accessibility tree (not visible to this CSS selector, or to
// axe's ruleset): selecting a value in all three sliders showed 10 live roots, not 4. Fixed in the app
// (aria-live="off" on each <output>, keeping its semantic role without the automatic announcement) and
// here: the query now matches `output` too, and excludes anything explicitly marked `aria-live="off"`,
// so a regression that reintroduces a live <output> (or removes the override) is actually caught.
test("exactly 4 live regions are always mounted (including output elements' implicit role); restoration's status text updates once Compare runs", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".provenance");
  const liveRegions = page.locator('[role="status"]:not([aria-live="off"]), [role="alert"]:not([aria-live="off"]), output:not([aria-live="off"])');
  await expect(liveRegions).toHaveCount(4);
  // populate every <output> in both placements (home + lab) to prove they don't count even when rendered
  await controlHome(page, "Alter line capacity").locator('select').selectOption({ index: 1 });
  await controlHome(page, "Increase load").locator('select').selectOption({ index: 1 });
  await controlHome(page, "Reduce generator").locator('select').selectOption({ index: 1 });
  await controlLab(page, "Alter line capacity").locator('select').selectOption({ index: 1 });
  await controlLab(page, "Increase load").locator('select').selectOption({ index: 1 });
  await controlLab(page, "Reduce generator").locator('select').selectOption({ index: 1 });
  await expect(page.locator('output')).toHaveCount(6);
  await expect(liveRegions).toHaveCount(4);
  const restorationStatus = page.getByTestId("restoration-status-region-status");
  await expect(restorationStatus).toHaveText("");
  await home(page).getByRole("button", { name: "Compare" }).click();
  await expect(restorationStatus).toHaveText(/restoration orders ranked\./, { timeout: 5000 });
  await expect(liveRegions).toHaveCount(4);
});
