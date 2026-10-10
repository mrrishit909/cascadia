// Dedicated coverage for the roving-tabindex keyboard navigation NetworkView.tsx gained for the
// chapter shell (docs/ART_DIRECTION.md section 1 "Navigation", DESIGN_SYSTEM.json's
// componentStates.selectableElement.focusVisible: "roving tabindex across elements, Arrow keys move
// along topology neighbors"). Only ONE bus/line/candidate is ever a Tab stop at a time; everything else
// is tabIndex=-1; Arrow keys move the single stop along the network's own graph (a bus's incident
// lines, a line's two endpoint buses) instead of requiring up to ~71 Tab presses to reach one element.
import { expect, test } from "@playwright/test";

test("only one bus/line is a Tab stop; Arrow keys move it along topology neighbors; a click re-syncs it", async ({ page }) => {
  await page.goto("/");
  await page.waitForSelector(".provenance");

  // Exactly one element in the whole stage has tabindex="0" at rest (bus 0, the default).
  await expect(page.locator('[data-testid="bus"][data-bus="0"]')).toHaveAttribute("tabindex", "0");
  const zeroTabStops = page.locator('[data-testid="bus"][tabindex="0"], [data-testid="line"][tabindex="0"]');
  await expect(zeroTabStops).toHaveCount(1);
  const negTabStops = page.locator('[data-testid="bus"][tabindex="-1"], [data-testid="line"][tabindex="-1"]');
  await expect(negTabStops.first()).toBeVisible(); // every OTHER bus/line is -1, not absent from the tab order entirely

  // Bus 0's real topology (public/data/raw-metadata/case30.json): incident lines 0 (0-1) and 1 (0-2).
  await page.locator('[data-testid="bus"][data-bus="0"]').focus();
  await page.keyboard.press("ArrowRight"); // -> first incident line (cycles through ALL of bus 0's incident lines on repeat)
  const line0 = page.locator('[data-testid="line"][data-line="0"]');
  await expect(line0).toBeFocused();
  await expect(line0).toHaveAttribute("tabindex", "0");
  // bus 0 is no longer the tab stop once focus moved on
  await expect(page.locator('[data-testid="bus"][data-bus="0"]')).toHaveAttribute("tabindex", "-1");
  await expect(zeroTabStops).toHaveCount(1); // still exactly one, just a different element now

  // From line 0 (endpoints bus 0 and bus 1), ArrowRight moves to one of its two endpoint buses.
  await page.keyboard.press("ArrowRight");
  const reachedBus0 = await page.locator('[data-testid="bus"][data-bus="0"]').evaluate(el => el === document.activeElement);
  const reachedBus1 = await page.locator('[data-testid="bus"][data-bus="1"]').evaluate(el => el === document.activeElement);
  expect(reachedBus0 || reachedBus1).toBe(true); // exactly one of this line's two real endpoints, not some arbitrary element
  await expect(zeroTabStops).toHaveCount(1);

  // A direct click/focus on an unrelated bus re-syncs the roving model to it (no DOM/React-state drift):
  // the NEXT Arrow press must navigate from the clicked bus's own neighbors, not whatever was roving
  // before the click.
  await page.locator('[data-testid="bus"][data-bus="5"]').focus();
  await expect(page.locator('[data-testid="bus"][data-bus="5"]')).toHaveAttribute("tabindex", "0");
  await expect(zeroTabStops).toHaveCount(1);
  await page.keyboard.press("ArrowLeft");
  // whatever bus 5 is neighbor-cycled to, it must be a LINE actually incident to bus 5, not a leftover
  // neighbor of bus 0/1 from before the click
  const focusedAfter = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el ? { testid: el.getAttribute("data-testid"), line: el.getAttribute("data-line") } : null;
  });
  expect(focusedAfter?.testid).toBe("line");
  // A hardcoded absolute path here (not import.meta.env.BASE_URL-aware, unlike the real app code in
  // useFixture.ts/state.tsx) broke the instant `base: '/cascadia/'` was set in vite.config.ts for the
  // GitHub Pages deploy -- found by the full suite, not assumed safe. `new URL(..., location.href)`
  // resolves relative to the page's own current base, same as the app's own fetches do.
  const network = await page.evaluate(async () => (await fetch(new URL("data/raw-metadata/case30.json", location.href))).json()) as { lines: { idx: number; from_bus: number; to_bus: number }[] };
  const focusedLine = network.lines.find(l => String(l.idx) === focusedAfter?.line);
  expect(focusedLine && (focusedLine.from_bus === 5 || focusedLine.to_bus === 5)).toBe(true);
});
