// Chapter 2 ("Demand and generation", editorial split, prose-led): scroll-scrubbed camera pan and
// a generation/demand balance-rule crossfade, hosting CAS-INT-002/003 (IncreaseLoad/ReduceGenerator).
// Default project reducedMotion:"reduce" is kept for the tests that don't need the real scrub tween.
import { expect, test } from "@playwright/test";
import { scrollToChapter } from "./helpers/placement";

test.describe("entry (no-preference, real scrub)", () => {
  test.use({ reducedMotion: "no-preference" });
  test("camera starts at (near enough) the full default framing, generation row showing", async ({ page }) => {
    await page.goto("/");
    await scrollToChapter(page, "ch2");
    // scrollIntoViewIfNeeded doesn't guarantee landing at EXACTLY the section's top pixel, so the
    // scrub's progress at "entry" is very close to 0, not always precisely 0 -- assert near-zero
    // rather than an exact viewBox string match.
    const x = await page.locator(".stage-inner svg").getAttribute("viewBox").then(vb => Number(vb!.split(" ")[0]));
    expect(x).toBeLessThan(5);
    const genOpacity = await page.locator('[data-testid="balance-gen"]').evaluate(el => Number(getComputedStyle(el).opacity));
    expect(genOpacity).toBeGreaterThan(0.9);
    const demOpacity = await page.locator('[data-testid="balance-demand"]').evaluate(el => Number(getComputedStyle(el).opacity));
    expect(demOpacity).toBeLessThan(0.1);
  });
});

test("leaving chapter 2 resets the camera to the default framing (presentationCamera's reset-on-change guarantee)", async ({ page }) => {
  await page.goto("/");
  await scrollToChapter(page, "ch2");
  await page.evaluate(() => {
    const el = document.getElementById("ch2")!;
    window.scrollBy(0, el.getBoundingClientRect().height * 0.5);
  });
  await page.waitForTimeout(300);
  await scrollToChapter(page, "ch3");
  await expect(page.locator(".stage-inner svg")).toHaveAttribute("viewBox", "0 0 960 640");
});

test("analytical state preservation: scrolling/scrubbing through chapter 2 alone never creates a solver Worker", async ({ page }) => {
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
  await scrollToChapter(page, "ch2");
  await page.evaluate(() => {
    const el = document.getElementById("ch2")!;
    window.scrollBy(0, el.getBoundingClientRect().height * 0.8);
  });
  await page.waitForTimeout(300);
  const count = await page.evaluate(() => (window as unknown as { __workerCount: number }).__workerCount);
  expect(count).toBe(0);
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("end-state camera applied immediately, both generation and demand rows shown (not overlapping)", async ({ page }) => {
    await page.goto("/");
    await scrollToChapter(page, "ch2");
    await expect(page.locator(".stage-inner svg")).toHaveAttribute("viewBox", "60 40 760 560"); // Chapter2Scene.tsx's CH2_CAMERA
    const gen = page.locator('[data-testid="balance-gen"]');
    const dem = page.locator('[data-testid="balance-demand"]');
    await expect(gen).toHaveCSS("opacity", "1");
    await expect(dem).toHaveCSS("opacity", "1");
    await expect(gen).toHaveCSS("position", "static");
    await expect(dem).toHaveCSS("position", "static");
  });
});

test.describe("camera pan + balance-rule crossfade (no-preference, real scrub)", () => {
  test.use({ reducedMotion: "no-preference" });
  test("scrolling through the section pans the camera and crossfades generation into demand", async ({ page }) => {
    await page.goto("/");
    await scrollToChapter(page, "ch2");
    await page.waitForTimeout(200); // let the scrub ScrollTrigger recreate with the fresh active='ch2' closure
    await page.evaluate(() => {
      const el = document.getElementById("ch2")!;
      window.scrollBy(0, el.getBoundingClientRect().height * 0.5); // stay safely inside ch2's own scroll range; a too-aggressive fraction can scroll past it into ch3, killing this trigger before the poll below ever observes the panned state
    });
    await expect.poll(() => page.locator('[data-testid="balance-demand"]').evaluate(el => Number(getComputedStyle(el).opacity)))
      .toBeGreaterThan(0.4);
    const demOpacity = await page.locator('[data-testid="balance-demand"]').evaluate(el => Number(getComputedStyle(el).opacity));
    expect(demOpacity).toBeLessThan(0.6);
    const viewBox = await page.locator(".stage-inner svg").getAttribute("viewBox");
    expect(viewBox).not.toBe("0 0 960 640");
  });
});
