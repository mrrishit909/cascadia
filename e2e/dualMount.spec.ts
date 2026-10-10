// Architecture-stabilization gate, real-browser half (the vitest half, src/app/dualMount.test.tsx,
// proves React-level state sharing across two mounted instances). App.tsx does not yet dual-mount any
// control in the shipped app (chapters don't exist yet), so this can only verify the WORKER-SINGLETON
// invariant through the one existing CompareRestoration mount, not a true two-DOM-instance scenario --
// honestly scoped, not claimed as more than it is. Revisit once chapter scaffolding actually renders a
// control twice.
import { expect, test } from "@playwright/test";
import { controlHome, home } from "./helpers/placement";

test("at most one restoration Worker is ever constructed, across repeated Compare clicks", async ({ page }) => {
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
  // trigger the restoration Worker's lazy creation, then re-trigger with a different preset twice more
  await home(page).getByRole("button", { name: "Compare" }).click();
  await expect(home(page).getByTestId("cr-n-orders")).toHaveText("6", { timeout: 5000 });
  await controlHome(page, "Compare restoration").locator('select').selectOption("two_buses");
  await home(page).getByRole("button", { name: "Compare" }).click();
  await expect(home(page).getByTestId("cr-n-orders")).toHaveText("2", { timeout: 5000 });
  await controlHome(page, "Compare restoration").locator('select').selectOption("k5_mixed");
  await home(page).getByRole("button", { name: "Compare" }).click();
  await expect(home(page).getByTestId("cr-n-orders")).toHaveText("120", { timeout: 5000 });
  const restorationWorkers = await page.evaluate(() => (window as unknown as { __workerCount: number }).__workerCount);
  // exactly 1: the restoration Worker is created lazily on first Compare and reused for every
  // subsequent one, regardless of preset changes -- never re-created per click
  expect(restorationWorkers).toBe(1);
});
