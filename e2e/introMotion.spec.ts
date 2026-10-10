// Real-browser coverage for the shared GSAP lifecycle layer and intro beat 1 (cinematic-motion
// directive phase 6's acceptance gate). Opts OUT of the project's reducedMotion:"reduce" default
// (playwright.config.ts) specifically to exercise the real GSAP timeline -- every other e2e spec
// deliberately keeps the default so it isn't racing a motion sequence that has nothing to do with what
// it tests.
import { expect, test } from "@playwright/test";

test.use({ reducedMotion: "no-preference" });

test("beat 1: hero bus (bus 0) is visible, every other bus/line starts hidden", async ({ page }) => {
  await page.goto("/");
  const hero = page.locator('[data-testid="bus"][data-bus="0"]');
  const other = page.locator('[data-testid="bus"][data-bus="1"]');
  await expect(hero).toHaveCSS("opacity", "1");
  await expect(other).toHaveCSS("opacity", "0");
});

test("beat 1 reverses when scrolling back above the intro section", async ({ page }) => {
  await page.goto("/");
  const other = page.locator('[data-testid="bus"][data-bus="1"]');
  await expect(other).toHaveCSS("opacity", "0");
  // scroll down past the intro (ScrollTrigger's toggleActions reverses once the trigger point is left
  // going backward past "top center")
  await page.locator("#ch2").scrollIntoViewIfNeeded();
  await page.locator("#intro").scrollIntoViewIfNeeded();
  // back at the intro: the beat 1 state (hero visible, others hidden) must hold again, not some
  // half-reversed intermediate frame left over from scrolling away and back
  const hero = page.locator('[data-testid="bus"][data-bus="0"]');
  await expect(hero).toHaveCSS("opacity", "1");
  await expect(other).toHaveCSS("opacity", "0");
});

test("rapid scroll straight to chapter 6 does not leave the network stuck invisible", async ({ page }) => {
  // The real "rapid scrolling" failure mode this guards against: if a scene's end-state were only ever
  // set by the ScrollTrigger's own progress callbacks (which a fast-enough scroll could skip invoking
  // between keyframes), jumping straight past the intro could leave buses 1-29 stuck at the blackout
  // beat's opacity 0 forever. The real NetworkView rendering for chapter 6 doesn't depend on beat 1's
  // opacity style at all once the user has scrolled away -- confirmed directly here rather than assumed.
  await page.goto("/");
  await page.locator("#ch6").scrollIntoViewIfNeeded();
  const other = page.locator('[data-testid="bus"][data-bus="1"]');
  await expect(other).toBeVisible();
  // opacity must not still read "0" (the blackout-beat value) now that the user is deep in the lab
  await expect.poll(() => other.evaluate(el => getComputedStyle(el).opacity)).not.toBe("0");
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("loads the intro's final frame directly: every bus/line visible, the beat-4 fault already active, chrome already visible", async ({ page }) => {
    // The intro's own reduced-motion end state is beat 4's end state (fault + chrome visible), per
    // ART_DIRECTION.md's global rule 5 combined with the opening storyboard -- distinct from chapter 1's
    // OWN reduced-motion state (plain baseline, no fault), which newControls.spec.ts/the chapter suite
    // covers separately.
    await page.goto("/");
    const hero = page.locator('[data-testid="bus"][data-bus="0"]');
    const other = page.locator('[data-testid="bus"][data-bus="1"]');
    await expect(hero).toHaveCSS("opacity", "1");
    await expect(other).toHaveCSS("opacity", "1");
    await expect(page.locator('[data-testid="line"][data-line="33"]')).toHaveAttribute("data-outaged", "true");
    await expect(page.locator(".fig-index")).toHaveCSS("opacity", "1");
    await expect(page.getByRole("button", { name: "Skip intro" })).toHaveCSS("opacity", "1");
  });
});

test.describe("beats 2-4 and skip (no-preference, real timeline)", () => {
  test("full playback: lines assemble, then the fault activates around 9s with chrome fading in after", async ({ page }) => {
    await page.goto("/");
    const line33 = page.locator('[data-testid="line"][data-line="33"]');
    const figIndex = page.locator(".fig-index");
    // Before beat 4, the fault hasn't happened and chrome is still invisible.
    await expect(line33).not.toHaveAttribute("data-outaged", "true");
    await expect(figIndex).toHaveCSS("opacity", "0");
    await expect(line33).toHaveAttribute("data-outaged", "true", { timeout: 11000 });
    await expect(figIndex).toHaveCSS("opacity", "1", { timeout: 2000 });
  });

  test("Skip intro jumps to the final frame instantly and the superseded timeline never re-applies its own beats afterward", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1000); // mid beat 1, well before beats 2-4 would otherwise run
    await page.getByRole("button", { name: "Skip intro" }).click();
    const other = page.locator('[data-testid="bus"][data-bus="1"]');
    const core = page.locator('[data-testid="line"][data-line="0"] [data-testid="line-core"]');
    await expect(other).toHaveCSS("opacity", "1");
    await expect(page.locator('[data-testid="line"][data-line="33"]')).toHaveAttribute("data-outaged", "true");
    await expect(page.locator(".fig-index")).toHaveCSS("opacity", "1");
    // Discriminating regression check: a superseded timeline that kept running after Skip would re-dash
    // this line's core at beat 3 (~6s) or flicker the fault line at beat 4 (~9s). Wait past both and
    // confirm the skip-to state still holds, with no leftover dash styling from beat 2/3.
    await page.waitForTimeout(9000);
    await expect(other).toHaveCSS("opacity", "1");
    await expect(core).toHaveCSS("stroke-dasharray", "none");
  });

  test("scrolling away mid-playback stops the intro timeline from touching chapter DOM later", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(4000); // mid beat 2, lines still assembling
    await page.locator("#ch2").scrollIntoViewIfNeeded();
    const core = page.locator('[data-testid="line"][data-line="0"] [data-testid="line-core"]');
    // Discriminating regression check: a superseded timeline left alive would still fire beat 3's
    // dash-loop (~6s) and beat 4's fault swap (~9s) against DOM that's now showing a different chapter.
    await page.waitForTimeout(8000);
    await expect(core).toHaveCSS("stroke-dasharray", "none");
  });
});

test("the persistent stage is never remounted by the intro scene: the same SVG element survives beat 1's tween", async ({ page }) => {
  await page.goto("/");
  const svgId = await page.locator(".stage-inner svg").evaluate(el => {
    if (!el.dataset.e2eStableId) el.dataset.e2eStableId = Math.random().toString(36);
    return el.dataset.e2eStableId;
  });
  await page.waitForTimeout(1600); // past beat 1's 1.5s tween
  const svgIdAfter = await page.locator(".stage-inner svg").evaluate(el => el.dataset.e2eStableId);
  expect(svgIdAfter).toBe(svgId);
});

test("no solver Worker is created merely by scrolling through the intro and chapters", async ({ page }) => {
  // Presentation (scroll/camera/intro motion) must never touch analytical state (cinematic-motion
  // directive phase 4): scrolling through the intro and chapters, with no control interaction, must not
  // create a Worker or issue any LP request at all -- the main solver Worker is lazily created only on
  // a real user action (removeBus/setCapacity/etc, state.tsx), which this test deliberately never does.
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
  await page.locator("#ch6").scrollIntoViewIfNeeded();
  await page.locator("#intro").scrollIntoViewIfNeeded();
  const count = await page.evaluate(() => (window as unknown as { __workerCount: number }).__workerCount);
  expect(count).toBe(0); // lazily created only on a real solve; scrolling alone must never trigger one
});
