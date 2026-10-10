// Chapter 1 ("Grid formation", immersive canvas): the full network full-bleed, plus the legend
// plate (ART_DIRECTION.md section 3's "only other element"). Covers the directive's mandatory
// motion-behavior checklist for this chapter: entry, reverse, instant jump, reduced motion,
// analytical-state preservation. Default project reducedMotion:"reduce" is kept for most tests here
// (chapter 1's own reduced-motion state is just "instant baseline", nothing to opt out of); the one
// test that needs the real masked-reveal tween opts into "no-preference" explicitly.
import { expect, test } from "@playwright/test";
import { scrollToChapter } from "./helpers/placement";

test("entry: the legend plate shows real baseline figures, not placeholders", async ({ page }) => {
  await page.goto("/");
  await scrollToChapter(page, "ch1");
  const plate = page.locator(".legend-plate");
  await expect(plate).toHaveCSS("opacity", "1");
  await expect(plate).toContainText("30 buses, 41 lines");
  await expect(plate).toContainText("MW served");
  await expect(plate).toContainText("optimal");
  await expect(plate.locator("h2")).toContainText("Grid formation");
});

test("the network itself is visible behind chapter 1 (regression: chapter-section's opaque background used to hide the whole stage)", async ({ page }) => {
  await page.goto("/");
  await scrollToChapter(page, "ch1");
  const bus0 = page.locator('[data-testid="bus"][data-bus="0"]');
  await expect(bus0).toHaveCSS("opacity", "1");
  await expect(page.locator(".chapter-section#ch1")).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
});

test("reverse: scrolling from chapter 2 back up to chapter 1 re-shows the legend plate", async ({ page }) => {
  await page.goto("/");
  await scrollToChapter(page, "ch2");
  await expect(page.locator(".legend-plate")).toHaveCSS("opacity", "0");
  await scrollToChapter(page, "ch1");
  await expect(page.locator(".legend-plate")).toHaveCSS("opacity", "1");
});

test("instant jump: FIG index navigation straight to chapter 1 from chapter 6 shows the plate immediately, no replay needed to wait out", async ({ page }) => {
  await page.goto("/");
  await scrollToChapter(page, "ch6");
  await page.getByRole("link", { name: "FIG. 01" }).click();
  await expect(page.locator(".stage-sticky")).toHaveAttribute("data-active-chapter", "ch1");
  await expect(page.locator(".legend-plate")).toHaveCSS("opacity", "1");
});

test("chapter 1 never diverges from the baseline result: scrolling through it alone creates no solver Worker", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __workerCount: number }).__workerCount = 0;
    const RealWorker = window.Worker;
    // @ts-expect-error -- test instrumentation
    window.Worker = class extends RealWorker {
      constructor(...args: ConstructorParameters<typeof RealWorker>) {
        super(...args);
        (window as unknown as { __workerCount: number }).__workerCount++;
      }
    };
  });
  await page.goto("/");
  await scrollToChapter(page, "ch1");
  await scrollToChapter(page, "ch2");
  await scrollToChapter(page, "ch1");
  const count = await page.evaluate(() => (window as unknown as { __workerCount: number }).__workerCount);
  expect(count).toBe(0);
});

test.describe("masked title reveal (no-preference, real tween)", () => {
  test.use({ reducedMotion: "no-preference" });
  test("the chapter title wipes open on entry and re-clips on leaving", async ({ page }) => {
    await page.goto("/");
    const title = page.locator(".legend-plate h2");
    await scrollToChapter(page, "ch1");
    // Mid-tween (800ms total): still converging.
    await expect.poll(() => title.evaluate(el => getComputedStyle(el).clipPath)).not.toBe("inset(0px 0px 0%)");
    await expect.poll(() => title.evaluate(el => getComputedStyle(el).clipPath), { timeout: 1200 }).toBe("inset(0px 0px 0%)");
    await scrollToChapter(page, "ch2");
    await expect.poll(() => title.evaluate(el => getComputedStyle(el).clipPath)).toBe("inset(0px 0px 100%)");
  });
});
