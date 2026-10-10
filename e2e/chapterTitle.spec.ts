// ChapterTitle.tsx's masked reveal, used by all 6 chapter headings. Default project
// reducedMotion:"reduce" is kept where the real 800ms tween isn't what's under test.
import { expect, test } from "@playwright/test";
import { scrollToChapter } from "./helpers/placement";

test.describe("stale-tween regression (no-preference, real tween)", () => {
  test.use({ reducedMotion: "no-preference" });
  test("REGRESSION: leaving a chapter mid-reveal doesn't let the old tween re-open the title after it's been hidden", async ({ page }) => {
    // Same bug class IntroSequence's own review caught: useGSAP does not revert a running tween just
    // because `active` changed again before it finished. Entering ch1 arms an 800ms clip-path tween;
    // leaving within that window (a fast FIG-index jump) must hide it immediately AND stay hidden --
    // a surviving old tween would keep animating clip-path back toward 0% afterward, re-revealing it.
    await page.goto("/");
    await scrollToChapter(page, "ch1");
    await page.waitForTimeout(100); // mid-reveal, well before the 800ms tween completes
    await page.getByRole("link", { name: "FIG. 03" }).click();
    await expect(page.locator(".stage-sticky")).toHaveAttribute("data-active-chapter", "ch3", { timeout: 5000 });
    const title = page.locator(".legend-plate h2");
    await expect(title).toHaveCSS("clip-path", "inset(0px 0px 100%)");
    await page.waitForTimeout(1000); // past where the old tween would have finished, if it survived
    await expect(title).toHaveCSS("clip-path", "inset(0px 0px 100%)");
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("REGRESSION: an inactive chapter's title is never clipped under reduced motion (no blank-gap heading)", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(300);
    // ch2's own title lives inside its chapter-prose column, not yet scrolled to -- still must read as
    // fully open, not a blank clipped gap, since reduced motion means "immediate text" unconditionally.
    const ch2Title = page.locator("#ch2 .chapter-prose h2");
    await expect(ch2Title).toHaveCSS("clip-path", "inset(0px 0px 0%)");
  });
});
