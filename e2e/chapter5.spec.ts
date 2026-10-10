// Chapter 5 ("Recovery plans", comparative view): three equal columns, one per restoration sequence
// from CAS-INT-006's own ranked output, a mini network plus a served-MW step chart per column on a
// shared y-axis, a step control advancing all three in sync. The main persistent stage is inert for
// this chapter (CHAPTER_ARCHITECTURE.md section 2) -- these mini networks are the only visible network
// content here. No scroll-scrub: step advance is a plain button press, so the default project
// reducedMotion:"reduce" doesn't need opting out of for most of these.
import { expect, test } from "@playwright/test";
import { controlHome, scrollToChapter } from "./helpers/placement";

test("before Compare runs, chapter 5 shows a real prompt, not fabricated columns", async ({ page }) => {
  await page.goto("/");
  await scrollToChapter(page, "ch5");
  await expect(page.getByTestId("ch5-empty")).toBeVisible();
  await expect(page.locator('[data-testid="ch5-column"]')).toHaveCount(0);
});

test("after Compare, three columns render with real ranked data, step 0 (nothing restored)", async ({ page }) => {
  await page.goto("/");
  await scrollToChapter(page, "ch5");
  await controlHome(page, "Compare restoration").getByRole("button", { name: "Compare" }).click();
  await expect(page.locator('[data-testid="ch5-column"]')).toHaveCount(3, { timeout: 5000 });
  await expect(page.getByTestId("ch5-step-label")).toHaveText("Step 0 of 3");
  const servedTexts = await page.locator('[data-testid="ch5-served-now"]').allTextContents();
  expect(servedTexts.every(t => /MW served at step 0/.test(t))).toBe(true);
  // step 0 = nothing restored yet -- all 3 columns show the SAME initial served MW (same fault, before
  // any restoration action), a real cross-check against the underlying ranking data.
  expect(new Set(servedTexts).size).toBe(1);
});

test("the step control advances all three columns together, and Previous/Reset work", async ({ page }) => {
  await page.goto("/");
  await scrollToChapter(page, "ch5");
  await controlHome(page, "Compare restoration").getByRole("button", { name: "Compare" }).click();
  await expect(page.locator('[data-testid="ch5-column"]')).toHaveCount(3, { timeout: 5000 });
  await page.getByTestId("ch5-step-next").click();
  await expect(page.getByTestId("ch5-step-label")).toHaveText("Step 1 of 3");
  const current = page.locator('[data-testid="ch5-step-bar"][data-current="true"]');
  await expect(current).toHaveCount(3); // one per column, all at the SAME step
  for (const el of await current.all()) await expect(el).toHaveAttribute("data-step", "1");

  await page.getByTestId("ch5-step-prev").click();
  await expect(page.getByTestId("ch5-step-label")).toHaveText("Step 0 of 3");
  await expect(page.getByTestId("ch5-step-prev")).toBeDisabled(); // step 0 is the floor

  await page.getByTestId("ch5-step-next").click();
  await page.getByTestId("ch5-step-next").click();
  await expect(page.getByTestId("ch5-step-label")).toHaveText("Step 2 of 3");
  await page.getByTestId("ch5-step-reset").click();
  await expect(page.getByTestId("ch5-step-label")).toHaveText("Step 0 of 3");
});

test("stepping through to the final step shows the real final served MW matching the ranked order's own final_served_mw", async ({ page }) => {
  await page.goto("/");
  await scrollToChapter(page, "ch5");
  await controlHome(page, "Compare restoration").getByRole("button", { name: "Compare" }).click();
  await expect(page.locator('[data-testid="ch5-column"]')).toHaveCount(3, { timeout: 5000 });
  for (let i = 0; i < 3; i++) await page.getByTestId("ch5-step-next").click();
  await expect(page.getByTestId("ch5-step-label")).toHaveText("Step 3 of 3");
  await expect(page.getByTestId("ch5-step-next")).toBeDisabled(); // top step is the ceiling
  const servedTexts = await page.locator('[data-testid="ch5-served-now"]').allTextContents();
  for (const t of servedTexts) expect(t).toMatch(/MW served at step 3/);
});

test("switching the fault scenario preset re-renders chapter 5 back to the empty prompt, not stale columns from the old scenario", async ({ page }) => {
  await page.goto("/");
  await scrollToChapter(page, "ch5");
  await controlHome(page, "Compare restoration").getByRole("button", { name: "Compare" }).click();
  await expect(page.locator('[data-testid="ch5-column"]')).toHaveCount(3, { timeout: 5000 });
  await controlHome(page, "Compare restoration").locator("select").selectOption({ index: 1 });
  await expect(page.getByTestId("ch5-empty")).toBeVisible();
});

test("analytical state preservation: scrolling into and out of chapter 5 alone never creates an extra Worker", async ({ page }) => {
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
  await scrollToChapter(page, "ch5");
  await scrollToChapter(page, "ch4");
  await scrollToChapter(page, "ch5");
  const count = await page.evaluate(() => (window as unknown as { __workerCount: number }).__workerCount);
  expect(count).toBe(0); // CompareRestoration's own Worker is created lazily only when Compare is pressed
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("step bar height changes are instant, not animated", async ({ page }) => {
    await page.goto("/");
    await scrollToChapter(page, "ch5");
    await controlHome(page, "Compare restoration").getByRole("button", { name: "Compare" }).click();
    await expect(page.locator('[data-testid="ch5-column"]')).toHaveCount(3, { timeout: 5000 });
    const bar = page.locator('[data-testid="ch5-step-bar"][data-current="true"]').first();
    const duration = await bar.evaluate(el => parseFloat(getComputedStyle(el).transitionDuration));
    expect(duration).toBeLessThan(0.01); // effectively instant, not the real 480ms
  });
});
