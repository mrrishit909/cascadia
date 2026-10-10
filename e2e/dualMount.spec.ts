// Architecture-stabilization gate, real-browser half (the vitest half, src/app/dualMount.test.tsx,
// proves React-level state sharing across two mounted instances). App.tsx's LabStub now permanently
// mounts a second, real 'lab' placement of all 7 controls -- these tests drive THAT placement directly
// (not just the home one), which is the actual two-DOM-instance proof this file's own header used to
// (honestly) say didn't exist yet. Corrected per independent review: the prior header claimed this was
// still "not a true two-DOM-instance scenario" after LabStub had already landed.
import { expect, test } from "@playwright/test";
import { controlHome, controlLab, home, lab } from "./helpers/placement";

test("at most one restoration Worker is ever constructed, interacting with BOTH the home and lab placements", async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __workerCount: number }).__workerCount = 0
    const RealWorker = window.Worker
    // @ts-expect-error -- test instrumentation, not real class augmentation
    window.Worker = class extends RealWorker {
      constructor(...args: ConstructorParameters<typeof RealWorker>) {
        super(...args)
        ;(window as unknown as { __workerCount: number }).__workerCount++
      }
    }
  });
  await page.goto("/");
  await page.waitForSelector(".provenance");
  // trigger the restoration Worker's lazy creation from HOME, then re-trigger from LAB with a different
  // preset -- a per-mount (not per-provider) Worker would show up as a second construction here
  await home(page).getByRole("button", { name: "Compare" }).click();
  await expect(home(page).getByTestId("cr-n-orders")).toHaveText("6", { timeout: 5000 });
  // the lab's OWN instance must already reflect home's result (shared AppState.restoration)
  await expect(lab(page).getByTestId("cr-n-orders")).toHaveText("6", { timeout: 5000 });
  await controlLab(page, "Compare restoration").locator('select').selectOption("two_buses");
  await lab(page).getByRole("button", { name: "Compare" }).click();
  await expect(lab(page).getByTestId("cr-n-orders")).toHaveText("2", { timeout: 5000 });
  await expect(home(page).getByTestId("cr-n-orders")).toHaveText("2", { timeout: 5000 });
  await controlHome(page, "Compare restoration").locator('select').selectOption("k5_mixed");
  await home(page).getByRole("button", { name: "Compare" }).click();
  await expect(home(page).getByTestId("cr-n-orders")).toHaveText("120", { timeout: 5000 });
  const restorationWorkers = await page.evaluate(() => (window as unknown as { __workerCount: number }).__workerCount);
  // exactly 1: the restoration Worker is created lazily on first Compare (from EITHER placement) and
  // reused for every subsequent one, regardless of which placement fires it -- never re-created per click
  // or per mount.
  expect(restorationWorkers).toBe(1);
});

test("a main-scenario change confirmed from the LAB placement propagates to the HOME placement (and the shared stage)", async ({ page }) => {
  // The vitest half (dualMount.test.tsx) proves this at the React/jsdom level with a real Worker; this
  // proves it end to end in the real browser against the real production build, through the real stage
  // (NetworkView) both placements share.
  await page.goto("/");
  await page.waitForSelector(".provenance");
  await controlLab(page, "Alter line capacity").locator('select').selectOption({ index: 10 }); // line 9
  const labSlider = controlLab(page, "Alter line capacity").getByRole("slider");
  await labSlider.focus();
  await page.keyboard.press("ArrowLeft"); // 1.00x -> 0.95x
  await expect(controlLab(page, "Alter line capacity").getByTestId("cap-factor")).toHaveText("0.95x");
  // solver-derived: both the home placement's own readout AND the shared NetworkView stage (outside
  // either placement) must reflect the lab-confirmed change
  await expect(controlHome(page, "Alter line capacity").getByTestId("cap-factor")).toHaveText("0.95x", { timeout: 3000 });
  await expect.poll(() => page.locator('[data-testid="line"][data-line="9"]').getAttribute("aria-label"), { timeout: 3000 }).toContain("30.40 MW");
});
