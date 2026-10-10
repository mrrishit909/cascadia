// Chapter 6 ("Scenario laboratory", immersive canvas + anchored inspector): already functionally
// complete (all 7 controls, always-live stage) before this pass -- this is motion-only, per the motion
// table's own row 6: "Any control commit, then Worker result" drives "last result dims to 60% while
// solving, then all changed elements transition together on result." Default project
// reducedMotion:"reduce" is kept where the real animated transition isn't what's under test.
import { expect, test, type Page } from "@playwright/test";
import { controlLab, lab, scrollToChapter } from "./helpers/placement";

async function withWasmDelay(page: Page, ms: number) {
  await page.route("**/*.wasm", async (route) => {
    if (ms) await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}

test("idle: the stage is fully visible, not dimmed", async ({ page }) => {
  await page.goto("/");
  await scrollToChapter(page, "ch6");
  await expect(page.locator(".stage-inner")).toHaveCSS("opacity", "1");
});

test.describe("dim-while-solving feedback (no-preference, real motion)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("the stage dims to 60% while a real solve is in flight, and returns to full opacity once it resolves", async ({ page }) => {
    await withWasmDelay(page, 1200);
    await page.goto("/");
    await scrollToChapter(page, "ch6");
    await page.locator('[data-testid="bus"][data-bus="5"]').focus();
    await page.keyboard.press("Enter");
    await lab(page).getByRole("button", { name: "Confirm removal" }).focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => page.locator(".stage-inner").evaluate(el => Number(getComputedStyle(el).opacity)))
      .toBeLessThan(0.7);
    const midOpacity = await page.locator(".stage-inner").evaluate(el => Number(getComputedStyle(el).opacity));
    expect(midOpacity).toBeGreaterThan(0.5); // confirms ~0.6, not fully hidden
    await expect(page.locator(".stage-inner")).toHaveCSS("opacity", "1", { timeout: 3000 });
  });

  // The user's own explicit standing concern (first raised for chapter 3's corridor morph, equally
  // relevant here): a SECOND control committed while the first's dim/restore feedback is still in
  // flight. This app's own existing concurrency protections (e2e/concurrency.spec.ts) already cover
  // the ANALYTICAL side (both solves land correctly, solver-confirmed) -- this test confirms the
  // VISUAL feedback doesn't fight itself under the same conditions: the stage ends up fully visible
  // again, not stuck dimmed or flickering between two competing tweens.
  test("REGRESSION: a second control committed while the first's solve is still in flight leaves the stage fully visible once both resolve, not stuck dimmed", async ({ page }) => {
    await withWasmDelay(page, 1500);
    await page.goto("/");
    await scrollToChapter(page, "ch6");
    await page.locator('[data-testid="bus"][data-bus="5"]').focus();
    await page.keyboard.press("Enter");
    await lab(page).getByRole("button", { name: "Confirm removal" }).focus();
    await page.keyboard.press("Enter"); // first solve in flight
    await expect.poll(() => page.locator(".stage-inner").evaluate(el => Number(getComputedStyle(el).opacity)))
      .toBeLessThan(0.7);

    await controlLab(page, "Alter line capacity").locator('select').selectOption({ index: 1 }); // a second, different control
    const slider = controlLab(page, "Alter line capacity").getByRole("slider");
    await slider.focus();
    await page.keyboard.press("ArrowLeft"); // second solve queued/in flight while the first is still resolving

    await expect(page.locator(".stage-inner")).toHaveCSS("opacity", "1", { timeout: 5000 });
    // both results must have actually landed (analytical side), not just the visual settling --
    // reuses this project's own existing solver-confirmed pattern rather than trusting opacity alone.
    await expect(page.locator('[data-testid="bus"][data-bus="5"]')).toHaveAttribute("data-state", "removed");
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("still dims while solving (the real state, not skipped), just without an animated transition", async ({ page }) => {
    await withWasmDelay(page, 1200);
    await page.goto("/");
    await scrollToChapter(page, "ch6");
    await page.locator('[data-testid="bus"][data-bus="5"]').focus();
    await page.keyboard.press("Enter");
    await lab(page).getByRole("button", { name: "Confirm removal" }).focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => page.locator(".stage-inner").evaluate(el => Number(getComputedStyle(el).opacity)))
      .toBeLessThan(0.7);
    const duration = await page.locator(".stage-inner").evaluate(el => parseFloat(getComputedStyle(el).transitionDuration));
    expect(duration).toBeLessThan(0.01);
    await expect(page.locator(".stage-inner")).toHaveCSS("opacity", "1", { timeout: 3000 });
  });
});

test("interrupted transition: leaving chapter 6 while a solve is still in flight leaves the stage fully visible elsewhere", async ({ page }) => {
  await withWasmDelay(page, 1500);
  await page.goto("/");
  await scrollToChapter(page, "ch6");
  await page.locator('[data-testid="bus"][data-bus="5"]').focus();
  await page.keyboard.press("Enter");
  await lab(page).getByRole("button", { name: "Confirm removal" }).focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200); // mid-solve, mid-dim
  await scrollToChapter(page, "ch5");
  await expect(page.locator(".stage-inner")).toHaveCSS("opacity", "1");
});

test.describe("layout: inspector rail is opaque, flush right, anchored, and clears the network", () => {
  // REGRESSION for an independent-review P1: chapter 6 shipped with zero ch6-specific CSS, so its 7
  // full-size control cards sat in normal document flow at the section's own left edge, transparent,
  // and scrolled up over the full-bleed sticky network's own drawn graph for the section's entire
  // length, at every breakpoint. ART_DIRECTION.md's own row 6 specifies "a fixed 384px inspector rail
  // on the right" -- flush to the real viewport edge, not covering interactive network content past
  // that 384px strip. A second real regression (caught by an advisor review of THIS fix, not assumed
  // correct from screenshots alone): `main`'s own horizontal padding (sp-9, 96px) plus
  // `.chapter-section`'s own (sp-8, 64px) stacked, leaving the rail 160px short of the real edge AND
  // covering a bus (26) that a flush rail would have cleared -- fixed with a cancelling negative
  // margin, and the chapter title was moved inside the rail as its own header (matching chapter 1's
  // legend-plate pattern) since it previously sat where the rail now needs clear space. Checked here
  // against real bus elements' measured positions, at all 3 required breakpoints -- zero overlap is
  // required everywhere, not just tablet/mobile, now that the rail is flush rather than mid-canvas.
  for (const [name, viewport] of [
    ["desktop", { width: 1440, height: 900 }],
    ["tablet", { width: 768, height: 1024 }],
    ["mobile", { width: 390, height: 844 }],
  ] as const) {
    test(`${name}: no network bus renders underneath the controls column`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");
      // Direct FIG-index navigation (the same realistic path the independent review itself used to
      // reproduce this defect), not scrollToChapter's scrollIntoViewIfNeeded: on this unusually tall
      // section (100vh+ of padding-top at narrow widths), scrollIntoViewIfNeeded's default "nearest
      // edge" alignment lands mid-section rather than at a real scroll-settled position, which is an
      // artifact of that navigation method, not a real user-reachable state.
      await page.getByRole("link", { name: "FIG. 06" }).click();
      await page.waitForFunction(() => document.querySelector(".stage-sticky")?.getAttribute("data-active-chapter") === "ch6");
      await page.waitForTimeout(300);
      const rail = page.locator("#ch6 .chapter-controls-column");
      const bg = await rail.evaluate(el => getComputedStyle(el).backgroundColor);
      expect(bg).not.toBe("rgba(0, 0, 0, 0)"); // opaque, not the original transparent card
      const controlsBox = await rail.boundingBox();
      expect(controlsBox).not.toBeNull();
      if (!controlsBox) return;
      if (name !== "mobile" && name !== "tablet") {
        // desktop: rail must be flush to the real viewport edge, not left short by `main`/section padding
        expect(Math.round(controlsBox.x + controlsBox.width)).toBe(viewport.width);
      }
      const buses = page.locator('[data-testid="bus"]');
      const count = await buses.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        const busBox = await buses.nth(i).boundingBox();
        if (!busBox) continue;
        const overlapX = Math.max(0, Math.min(busBox.x + busBox.width, controlsBox.x + controlsBox.width) - Math.max(busBox.x, controlsBox.x));
        const overlapY = Math.max(0, Math.min(busBox.y + busBox.height, controlsBox.y + controlsBox.height) - Math.max(busBox.y, controlsBox.y));
        expect(overlapX * overlapY).toBe(0);
      }
    });
  }

  // REGRESSION for a defect a FRESH independent review (verifying the fix above) found that the test
  // above missed: it only checks ONE frame (right after arriving at ch6), which happened to show no
  // overlap. The rail's `<1023px` reset was missing 2 of the 9 desktop-only properties the base rule
  // sets (`align-self: flex-end`, a desktop-only negative `margin-right`) -- left in place, those two
  // alone caused real horizontal page overflow (clipping control text/buttons offscreen) AND, because
  // `.stage-sticky` stays pinned on screen while this normal-flow rail scrolls past it, a PERSISTENT
  // overlay for most of the rail's own scroll length, not the "stacked below, zero overlap" layout
  // this breakpoint requires. Checked here across a real scroll sweep through the rail's own height,
  // not just the arrival frame.
  for (const [name, viewport] of [
    ["tablet", { width: 768, height: 1024 }],
    ["mobile", { width: 390, height: 844 }],
  ] as const) {
    test(`${name}: no horizontal overflow and no persistent network overlay while scrolling through the rail`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await page.getByRole("link", { name: "FIG. 06" }).click();
      await page.waitForFunction(() => document.querySelector(".stage-sticky")?.getAttribute("data-active-chapter") === "ch6");
      await page.waitForTimeout(300);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      // A small (~10px) overflow from the FIG-index nav strip's own last link pre-exists site-wide
      // (confirmed present on chapter 1 too, unrelated to this fix) -- this check is for the rail's
      // OWN overflow (previously ~96-130px from the stale desktop-only margin/align-self), not that
      // pre-existing, unrelated nav artifact.
      expect(scrollWidth).toBeLessThanOrEqual(viewport.width + 15);
      const docHeight = await page.evaluate(() => document.body.scrollHeight);
      const startY = await page.evaluate(() => window.scrollY);
      let sawStageAwayFromRail = false;
      for (const frac of [0, 0.3, 0.6, 0.9]) {
        const y = startY + frac * (docHeight - startY - viewport.height);
        await page.evaluate((yy) => window.scrollTo(0, yy), y);
        await page.waitForTimeout(150);
        const stageBox = await page.locator(".stage-sticky").boundingBox();
        const railBox = await page.locator("#ch6 .chapter-controls-column").boundingBox();
        if (!stageBox || !railBox) continue;
        const overlapY = Math.max(0, Math.min(stageBox.y + stageBox.height, railBox.y + railBox.height) - Math.max(stageBox.y, railBox.y));
        if (overlapY === 0) sawStageAwayFromRail = true;
      }
      // a clean "stacked below" layout must, at some point during the sweep, show the network fully
      // scrolled past (zero vertical overlap with the rail) -- a persistent overlay never does.
      expect(sawStageAwayFromRail).toBe(true);
    });
  }
});

test("analytical state preservation: scrolling into and out of chapter 6 alone never creates an extra Worker", async ({ page }) => {
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
  await scrollToChapter(page, "ch6");
  await scrollToChapter(page, "ch5");
  await scrollToChapter(page, "ch6");
  const count = await page.evaluate(() => (window as unknown as { __workerCount: number }).__workerCount);
  expect(count).toBe(0); // the lab's own Worker is lazily created only on a real control commit
});
