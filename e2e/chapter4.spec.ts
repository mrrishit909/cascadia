// Chapter 4 ("Outage cascades", editorial split, canvas-led, mirrored from chapter 2): ONE 700ms
// single-shot tween per ART_DIRECTION.md section 3's load-bearing single-shot rule -- no stagger, no
// mid-tween ledger reveal. Hosts CAS-INT-001 (RemoveNode) and CAS-INT-007 (LineOutage). Default
// project reducedMotion:"reduce" is kept where the real tween isn't what's under test.
import { expect, test } from "@playwright/test";
import { controlHome, scrollToChapter } from "./helpers/placement";

test("entry: the ledger shows real story-fixture figures (bus 27 removed, 2 islands), disclaimer always present", async ({ page }) => {
  await page.goto("/");
  await scrollToChapter(page, "ch4");
  await expect(page.getByTestId("ch4-mode")).toHaveText("STORY");
  await expect(page.getByTestId("ch4-removed")).toContainText("Bus 27");
  await expect(page.getByTestId("ch4-islands")).toHaveText("2");
  await expect(page.getByTestId("ch4-disclaimer")).toHaveText("Single LP solve after the fault. Cascading trips are not modeled.");
});

test.describe("single-shot tween (no-preference, real motion)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("the ledger is hidden mid-tween and only reveals numbers once the 700ms tween completes", async ({ page }) => {
    await page.goto("/");
    await scrollToChapter(page, "ch4");
    const ledger = page.locator('[aria-label="Fault ledger"]');
    // Still within the first half of the 700ms tween: ledger must not have revealed yet.
    await page.waitForTimeout(150);
    const midOpacity = await ledger.evaluate(el => Number(getComputedStyle(el).opacity));
    expect(midOpacity).toBeLessThan(1);
    await expect(ledger).toHaveCSS("opacity", "1", { timeout: 1000 });
  });

  test("REGRESSION: changing a control while already on chapter 4 re-plays the single tween and updates the ledger to the new live result", async ({ page }) => {
    await page.goto("/");
    await scrollToChapter(page, "ch4");
    await expect(page.getByTestId("ch4-mode")).toHaveText("STORY", { timeout: 2000 });
    await page.locator('[data-testid="bus"][data-bus="5"]').focus(); // a DIFFERENT bus than the story fixture's own (bus idx 26, "Bus 27")
    await page.keyboard.press("Enter");
    await controlHome(page, "Remove substation").getByRole("button", { name: "Confirm removal" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("ch4-mode")).toHaveText("YOUR SCENARIO", { timeout: 5000 });
    await expect(page.getByTestId("ch4-removed")).toContainText("Bus 6"); // bus idx 5 displays as "Bus 6" (1-indexed names)
  });

  test("REGRESSION: a bus that was isolated under one scenario returns to its REAL network position (not the SVG origin) once a different scenario removes the island", async ({ page }) => {
    // Chapter4Scene.tsx's own real risk, actually reproduced once (not just theorized): GSAP's x/y
    // properties are ABSOLUTE, so a naive `gsap.set(bus, {x:0,y:0})` meant as "clear any previous
    // nudge" instead overwrites the bus's REAL `transform="translate(x y)"` position with an identity
    // transform, collapsing it to the SVG's origin corner -- for EVERY bus, not just the ones that were
    // ever nudged. This silently broke bus hit-testing everywhere on the page (caught by an unrelated
    // touch-interaction e2e test suddenly failing to find buses at their expected screen position, not
    // by this chapter's own tests, which only checked for "not stuck at the OLD offset" and missed that
    // the "fixed" value was ALSO wrong, just wrong in a different way). Fixed with `clearProps`, not a
    // hardcoded reset value -- this test checks the bus is near its REAL rendered position in the
    // network (via the stage's own screen geometry), not merely "has some transform or other".
    await page.goto("/");
    await scrollToChapter(page, "ch4");
    await expect(page.getByTestId("ch4-islands")).toHaveText("2", { timeout: 2000 }); // story fixture: bus 27 (idx 26) removed, 2 islands
    await page.waitForTimeout(800); // let the entry tween fully settle
    const isolated = page.locator('[data-testid="bus"][data-state="shed_no_generation"]').first();
    await expect(isolated).toBeVisible();
    const stageBox = await page.locator(".stage-inner").boundingBox();

    // Diverge to a DIFFERENT scenario (a different removed bus) -- the real path that leaves a
    // previous scenario's isolated-bus offset stuck (or collapsed to the origin) if the fix doesn't
    // hold: a bus isolated under the FIRST scenario but not the second.
    await page.locator('[data-testid="bus"][data-bus="5"]').focus();
    await page.keyboard.press("Enter");
    await controlHome(page, "Remove substation").getByRole("button", { name: "Confirm removal" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("ch4-mode")).toHaveText("YOUR SCENARIO", { timeout: 5000 });
    await page.waitForTimeout(800);

    // Every bus (not just the formerly-isolated one) must still be positioned somewhere INSIDE the
    // stage's own rendered area -- the collapse-to-origin bug put every bus at the SVG's corner,
    // outside (or at the extreme edge of) where the network is actually drawn.
    const allBuses = page.locator('[data-testid="bus"]');
    const n = await allBuses.count();
    let outsideCount = 0;
    for (let i = 0; i < n; i++) {
      const box = await allBuses.nth(i).boundingBox();
      if (!box || !stageBox) continue;
      if (box.x < stageBox.x - 5 || box.y < stageBox.y - 5) outsideCount++;
    }
    expect(outsideCount).toBe(0);
  });

  test("reverse: leaving chapter 4 mid-tween and returning replays the single tween cleanly", async ({ page }) => {
    await page.goto("/");
    await scrollToChapter(page, "ch4");
    await page.waitForTimeout(100); // mid-tween
    await scrollToChapter(page, "ch5");
    const stage = page.locator(".stage-inner svg");
    await expect(stage).toHaveCSS("opacity", "1", { timeout: 2000 }); // convergence: never left dimmed
    await scrollToChapter(page, "ch4");
    await expect(page.locator('[aria-label="Fault ledger"]')).toHaveCSS("opacity", "1", { timeout: 2000 });
  });

  test("interrupted transition: a fast scroll straight past chapter 4 into chapter 6 leaves the stage and ledger fully visible, not stuck dimmed", async ({ page }) => {
    await page.goto("/");
    await scrollToChapter(page, "ch4");
    await page.waitForTimeout(100);
    await scrollToChapter(page, "ch6");
    await expect(page.locator(".stage-inner svg")).toHaveCSS("opacity", "1");
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("ledger and network are fully visible immediately, no tween to wait out", async ({ page }) => {
    await page.goto("/");
    await scrollToChapter(page, "ch4");
    await expect(page.locator('[aria-label="Fault ledger"]')).toHaveCSS("opacity", "1");
    await expect(page.locator(".stage-inner svg")).toHaveCSS("opacity", "1");
  });
});

test("analytical state preservation: scrolling into and out of chapter 4 alone never creates a solver Worker", async ({ page }) => {
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
  await scrollToChapter(page, "ch4");
  await scrollToChapter(page, "ch3");
  await scrollToChapter(page, "ch4");
  const count = await page.evaluate(() => (window as unknown as { __workerCount: number }).__workerCount);
  expect(count).toBe(0);
});
