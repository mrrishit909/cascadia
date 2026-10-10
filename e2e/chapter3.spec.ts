// Chapter 3 ("Capacity bottlenecks", focused inspector): the network shrinks into a locator inset
// and real measured line geometry morphs into horizontal corridor rails as the user scrolls, hosting
// CAS-INT-005 (AlterCapacity). Default project reducedMotion:"reduce" is kept where the real scrub
// tween isn't what's under test.
import { expect, test } from "@playwright/test";
import { controlHome, scrollToChapter } from "./helpers/placement";

async function scrollInto(page: import("@playwright/test").Page, frac: number) {
  await page.evaluate((f) => {
    const el = document.getElementById("ch3")!;
    window.scrollTo(0, el.offsetTop + el.offsetHeight * f);
  }, frac);
}

test("entry: 4 rails render with real baseline figures, no fabricated numbers", async ({ page }) => {
  await page.goto("/");
  await scrollToChapter(page, "ch3");
  const rails = page.locator('[data-testid="rail"]');
  await expect(rails).toHaveCount(4);
  for (let i = 0; i < 4; i++) {
    await expect(rails.nth(i).locator('[data-testid="rail-flow"]')).toContainText(/of .+ MW/);
  }
  await expect(page.getByTestId("rail-empty-inspected")).toHaveText("Inspected: none selected");
});

test("the rail set stays fixed (never reshuffles) while capacity changes alter the live result", async ({ page }) => {
  await page.goto("/");
  await scrollToChapter(page, "ch3");
  const before = await page.locator('[data-testid="rail"]').evaluateAll(els => els.map(el => el.getAttribute("data-rail-line")));
  await controlHome(page, "Alter line capacity").locator("select").selectOption({ index: 10 }); // line 9, already a rail
  const slider = controlHome(page, "Alter line capacity").getByRole("slider");
  await slider.focus();
  for (let i = 0; i < 6; i++) await page.keyboard.press("ArrowLeft"); // lower the capacity factor
  await expect(controlHome(page, "Alter line capacity").getByTestId("cap-factor")).not.toHaveText("1.00x", { timeout: 3000 });
  const after = await page.locator('[data-testid="rail"]').evaluateAll(els => els.map(el => el.getAttribute("data-rail-line")));
  expect(after).toEqual(before);
});

test("selecting a non-rail line (via AlterCapacity) adds a 5th INSPECTED rail with real readouts", async ({ page }) => {
  await page.goto("/");
  await scrollToChapter(page, "ch3");
  const railLines = await page.locator('[data-testid="rail"]').evaluateAll(els => els.map(el => Number(el.getAttribute("data-rail-line"))));
  const nonRail = [...Array(41).keys()].find(i => !railLines.includes(i))!;
  await controlHome(page, "Alter line capacity").locator("select").selectOption({ index: nonRail + 1 });
  await expect(page.locator(`[data-testid="rail"][data-rail-line="${nonRail}"]`)).toBeVisible();
  await expect(page.locator(`[data-testid="rail"][data-rail-line="${nonRail}"] .rail-label`)).toContainText("Inspected:");
  await expect(page.getByTestId("rail-empty-inspected")).toHaveCount(0);
});

test("clicking a rail's own readout selects that line, same shared selection AlterCapacity uses", async ({ page }) => {
  await page.goto("/");
  await scrollToChapter(page, "ch3");
  const firstRail = page.locator('[data-testid="rail-readout"]').first();
  const lineIdx = await page.locator('[data-testid="rail"]').first().getAttribute("data-rail-line");
  await firstRail.click();
  await expect(controlHome(page, "Alter line capacity").locator("select")).toHaveValue(lineIdx!);
});

test("leaving chapter 3 resets rail geometry and the locator inset returns to its default scale", async ({ page }) => {
  await page.goto("/");
  await scrollToChapter(page, "ch3");
  await page.waitForTimeout(200);
  await scrollInto(page, 0.4);
  await expect(page.locator(".corridor-strip")).toHaveCSS("opacity", "1");
  await scrollToChapter(page, "ch4");
  await expect(page.locator(".corridor-strip")).toHaveCSS("opacity", "0");
  await expect(page.locator(".stage-inner")).toHaveCSS("transform", "none");
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("rails render straight and horizontal immediately, no morph to wait out", async ({ page }) => {
    await page.goto("/");
    await scrollToChapter(page, "ch3");
    const line = page.locator('[data-testid="rail-line"]').first();
    const y1 = await line.evaluate(el => (el as unknown as SVGLineElement).y1.baseVal.value);
    const y2 = await line.evaluate(el => (el as unknown as SVGLineElement).y2.baseVal.value);
    expect(Math.abs(y1 - y2)).toBeLessThan(0.5);
  });
});

test.describe("scroll-scrub (no-preference, real geometry morph)", () => {
  test.use({ reducedMotion: "no-preference" });

  test("REGRESSION: the morph reaches its fully-horizontal end state while chapter 3 is still active", async ({ page }) => {
    await page.goto("/");
    await scrollToChapter(page, "ch3");
    await page.waitForTimeout(700); // settle the instant inset-shrink CSS transition before the scrub starts measuring
    await scrollInto(page, 0.4); // Chapter3Scene's own end:'40% top'
    await expect(page.locator(".stage-sticky")).toHaveAttribute("data-active-chapter", "ch3");
    const line = page.locator('[data-testid="rail-line"]').first();
    await expect.poll(async () => {
      const y1 = await line.evaluate(el => (el as unknown as SVGLineElement).y1.baseVal.value);
      const y2 = await line.evaluate(el => (el as unknown as SVGLineElement).y2.baseVal.value);
      return Math.abs(y1 - y2);
    }).toBeLessThan(0.5);
  });

  test("reverse scroll un-straightens the rails back toward the network", async ({ page }) => {
    await page.goto("/");
    await scrollToChapter(page, "ch3");
    await page.waitForTimeout(700);
    await scrollInto(page, 0.4);
    const line = page.locator('[data-testid="rail-line"]').first();
    await expect.poll(() => line.evaluate(el => {
      const l = el as unknown as SVGLineElement;
      return Math.abs(l.y1.baseVal.value - l.y2.baseVal.value);
    })).toBeLessThan(0.5);
    await scrollInto(page, 0.05);
    await expect.poll(() => line.evaluate(el => {
      const l = el as unknown as SVGLineElement;
      return Math.abs(l.y1.baseVal.value - l.y2.baseVal.value);
    })).toBeGreaterThan(1);
  });

  test("REGRESSION: direct FIG-index navigation from another chapter lands with rails already straight", async ({ page }) => {
    await page.goto("/");
    await scrollToChapter(page, "ch6");
    await page.getByRole("link", { name: "FIG. 03" }).click();
    await expect(page.locator(".stage-sticky")).toHaveAttribute("data-active-chapter", "ch3", { timeout: 5000 });
    const line = page.locator('[data-testid="rail-line"]').first();
    await expect.poll(() => line.evaluate(el => {
      const l = el as unknown as SVGLineElement;
      return Math.abs(l.y1.baseVal.value - l.y2.baseVal.value);
    }), { timeout: 5000 }).toBeLessThan(0.5);
  });

  test("interrupted transition: a fast scroll straight past chapter 3 into chapter 5 leaves no stale rail geometry visible", async ({ page }) => {
    await page.goto("/");
    await scrollToChapter(page, "ch3");
    await page.waitForTimeout(700);
    await scrollInto(page, 0.2); // mid-morph
    await scrollToChapter(page, "ch5");
    await expect(page.locator(".corridor-strip")).toHaveCSS("opacity", "0");
  });

  // The user's own explicit concern: a live control change WHILE the corridor morph is actively
  // scrubbing. This is where rendering-state synchronization (React re-rendering new rail readouts),
  // geometry measurement (Chapter3Scene re-measuring DOM it doesn't own), and the solver (a real
  // Worker LP solve) could plausibly interact badly -- the stale-closure/race bug classes this
  // project's other controls have each hit at least once (D1/N1/N2) are exactly the kind of thing to
  // check for here too, not assume away because the geometry code "looks independent" of state.tsx.
  test("REGRESSION: changing capacity mid-morph does not corrupt the rail geometry or drop the solver result", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", err => pageErrors.push(err.message));
    await page.goto("/");
    await scrollToChapter(page, "ch3");
    await page.waitForTimeout(700);
    await scrollInto(page, 0.2); // mid-morph: rails partway between network position and horizontal
    await controlHome(page, "Alter line capacity").locator("select").selectOption({ index: 10 }); // line 9, a rail
    const slider = controlHome(page, "Alter line capacity").getByRole("slider");
    await slider.focus();
    for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowLeft");
    // the real DC-OPF Worker solve must land (debounced ~250ms) without the scrub measurement loop
    // throwing or leaving the line's own rail stuck mid-morph
    await expect(controlHome(page, "Alter line capacity").getByTestId("cap-factor")).not.toHaveText("1.00x", { timeout: 3000 });
    await expect(page.locator('[data-testid="rail"][data-rail-line="9"] [data-testid="rail-flow"]')).not.toHaveText("", { timeout: 3000 });
    // finish the scroll to the morph's end and confirm it still converges correctly afterward --
    // proves the mid-scrub solve didn't leave Chapter3Scene's own measurement loop in a broken state
    await scrollInto(page, 0.4);
    const line = page.locator('[data-testid="rail"][data-rail-line="9"] [data-testid="rail-line"]');
    await expect.poll(() => line.evaluate(el => {
      const l = el as unknown as SVGLineElement;
      return Math.abs(l.y1.baseVal.value - l.y2.baseVal.value);
    })).toBeLessThan(0.5);
    expect(pageErrors).toEqual([]);
  });

  test("analytical state preservation: scrolling/scrubbing through chapter 3 alone never creates a solver Worker", async ({ page }) => {
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
    await scrollToChapter(page, "ch3");
    await page.waitForTimeout(700);
    await scrollInto(page, 0.4);
    const count = await page.evaluate(() => (window as unknown as { __workerCount: number }).__workerCount);
    expect(count).toBe(0);
  });
});
