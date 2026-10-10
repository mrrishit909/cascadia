// Chapter 2 ("Demand and generation", editorial split, prose-led): scroll-scrubbed camera pan and
// a generation/demand balance-rule crossfade, hosting CAS-INT-002/003 (IncreaseLoad/ReduceGenerator).
// Default project reducedMotion:"reduce" is kept for the tests that don't need the real scrub tween.
import { expect, test } from "@playwright/test";
import { scrollToChapter } from "./helpers/placement";

test.describe("entry (no-preference, real scrub)", () => {
  test.use({ reducedMotion: "no-preference" });
  test("camera starts at the full default framing, generation row showing", async ({ page }) => {
    await page.goto("/");
    await scrollToChapter(page, "ch2");
    await page.waitForTimeout(200);
    // ch2 is 200vh tall (Chapter2Scene's own scroll-runway fix) -- scrollIntoViewIfNeeded's "nearest"
    // alignment does NOT reliably land at the section's exact top edge for an element taller than the
    // viewport (confirmed directly: it landed ~40% into the scrub range in practice), so explicitly
    // scroll to its top pixel instead of trusting that helper for this specific "entry" assertion.
    await page.evaluate(() => window.scrollTo(0, document.getElementById("ch2")!.offsetTop));
    await expect(page.locator(".stage-inner svg")).toHaveAttribute("viewBox", "0 0 960 640");
    await expect(page.locator('[data-testid="balance-gen"]')).toHaveCSS("opacity", "1");
    await expect(page.locator('[data-testid="balance-demand"]')).toHaveCSS("opacity", "0");
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

  async function scrollInto(page: import("@playwright/test").Page, frac: number) {
    await page.evaluate((f) => {
      const el = document.getElementById("ch2")!;
      window.scrollTo(0, el.offsetTop + el.offsetHeight * f);
    }, frac);
  }

  test("scrolling through the section pans the camera and crossfades generation into demand", async ({ page }) => {
    await page.goto("/");
    await scrollToChapter(page, "ch2");
    await page.waitForTimeout(200); // let the scrub ScrollTrigger recreate with the fresh active='ch2' closure
    // Chapter2Scene's trigger spans only the section's first 60% (end:'60% top'), so scrub progress
    // = sectionFraction / 0.6 -- 0.3 of the section's height targets scrub progress ~0.5, not 0.5
    // itself (an earlier version of this test scrolled to 0.5 directly, landing at progress 0.5/0.6 =
    // 0.83 and deterministically failing the <0.6 assertion below; caught by actually re-running the
    // suite rather than trusting it had passed once).
    await scrollInto(page, 0.3);
    await expect.poll(() => page.locator('[data-testid="balance-demand"]').evaluate(el => Number(getComputedStyle(el).opacity)))
      .toBeGreaterThan(0.4);
    const demOpacity = await page.locator('[data-testid="balance-demand"]').evaluate(el => Number(getComputedStyle(el).opacity));
    expect(demOpacity).toBeLessThan(0.6);
    const viewBox = await page.locator(".stage-inner svg").getAttribute("viewBox");
    expect(viewBox).not.toBe("0 0 960 640");
  });

  test("REGRESSION: the scrub reaches its full end state (CH2_CAMERA, demand fully shown) while chapter 2 is still the active chapter", async ({ page }) => {
    // The original end:'bottom top' made progress=1 unreachable while ch2 was still active -- by the
    // time the section had fully scrolled past, useActiveChapter had already handed off to ch3, and
    // every subsequent claimCamera call was silently dropped by its ownership guard. Chapter2Scene's
    // end is now '60% top' specifically to leave a safety margin before that handoff (confirmed
    // empirically: the handoff happens around 75-80% through the section).
    await page.goto("/");
    await scrollToChapter(page, "ch2");
    await page.waitForTimeout(200);
    await scrollInto(page, 0.6);
    await expect(page.locator(".stage-sticky")).toHaveAttribute("data-active-chapter", "ch2");
    await expect(page.locator(".stage-inner svg")).toHaveAttribute("viewBox", "60 40 760 560");
    await expect(page.locator('[data-testid="balance-demand"]')).toHaveCSS("opacity", "1");
  });

  test("reverse scroll plays the crossfade and camera pan backward", async ({ page }) => {
    await page.goto("/");
    await scrollToChapter(page, "ch2");
    await page.waitForTimeout(200);
    await scrollInto(page, 0.6);
    await expect(page.locator('[data-testid="balance-demand"]')).toHaveCSS("opacity", "1");
    await scrollInto(page, 0.2);
    await expect.poll(() => page.locator('[data-testid="balance-demand"]').evaluate(el => Number(getComputedStyle(el).opacity)))
      .toBeLessThan(0.45);
    const demOpacity = await page.locator('[data-testid="balance-demand"]').evaluate(el => Number(getComputedStyle(el).opacity));
    expect(demOpacity).toBeGreaterThan(0.2);
  });

  test("interrupted transition: a fast scroll straight past chapter 2 into chapter 4 leaves no stale camera claim behind", async ({ page }) => {
    await page.goto("/");
    await scrollToChapter(page, "ch2");
    await page.waitForTimeout(200);
    await scrollInto(page, 0.4); // mid-scrub, camera partially panned
    await scrollToChapter(page, "ch4"); // jump straight past ch3 without settling anywhere in between
    await expect(page.locator(".stage-inner svg")).toHaveAttribute("viewBox", "0 0 960 640");
  });

  test("REGRESSION: direct FIG-index navigation from another chapter lands in chapter 2's end state, not its entry", async ({ page }) => {
    await page.goto("/");
    await scrollToChapter(page, "ch6");
    await page.getByRole("link", { name: "FIG. 02" }).click();
    await expect(page.locator(".stage-sticky")).toHaveAttribute("data-active-chapter", "ch2", { timeout: 5000 });
    await expect(page.locator(".stage-inner svg")).toHaveAttribute("viewBox", "60 40 760 560", { timeout: 5000 });
    await expect(page.locator('[data-testid="balance-demand"]')).toHaveCSS("opacity", "1");
  });
});
