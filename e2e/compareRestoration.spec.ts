// e2e coverage for CAS-INT-006 (compare restoration) against the real production build/Worker.
import { expect, test, type Page } from "@playwright/test";

async function withWasmDelay(page: Page, ms: number) {
  await page.route("**/*.wasm", async (route) => {
    if (ms) await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}

// Reference values from verification/REFERENCE_RESULTS/add_line_restoration.json's restoration_cases,
// derived from the Python oracle via research/evaluate/add_line_restoration.py's RESTORE dict -- pins
// CompareRestoration.tsx's hardcoded PRESETS against the source of truth, so the two can't silently
// drift apart.
const REFERENCE = {
  island_pocket_plus_line9: { n_orders: 6, best_order: "0, 1, 2", best_served: "554.60" },
  bus_and_lines: { n_orders: 6, best_order: "0, 1, 2", best_served: "554.60" },
  two_buses: { n_orders: 2, best_order: "1, 0", best_served: "343.00" },
  k5_mixed: { n_orders: 120, best_order: "0, 3, 1, 2, 4", best_served: "910.60" },
};

for (const [label, ref] of Object.entries(REFERENCE)) {
  test(`pinned to the Python oracle: ${label} ranks ${ref.n_orders} orders, best is [${ref.best_order}] at ${ref.best_served}`, async ({ page }) => {
    await page.goto("/");
    await page.locator('section:has-text("Compare restoration") select').selectOption(label);
    await page.getByRole("button", { name: "Compare" }).click();
    await expect(page.getByTestId("cr-n-orders")).toHaveText(String(ref.n_orders), { timeout: 5000 });
    await expect(page.getByTestId("cr-best-served")).toHaveText(ref.best_served);
    await expect(page.locator('section:has-text("Compare restoration")')).toContainText(`order [${ref.best_order}]`);
  });
}

test("choosing a non-best order shows its own rank and the gap behind the best", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Compare" }).click(); // default preset: island_pocket_plus_line9
  await expect(page.getByTestId("cr-n-orders")).toHaveText("6", { timeout: 5000 });
  const rows = page.locator('section:has-text("Compare restoration") li button');
  await expect(rows).toHaveCount(5); // TOP_SHOWN=5 of 6 orders shown by default (rank 1 already chosen)
  await rows.nth(4).click(); // pick a lower-ranked order
  await expect(page.getByTestId("cr-chosen-rank")).not.toHaveText("1");
  await expect(page.locator('div[aria-label="Chosen order detail"]')).toContainText("behind best");
});

test("isolation: Compare's own request does not hang an unrelated control's in-flight solve", async ({ page }) => {
  // The REAL D1-class risk this isolated private Worker prevents: if Compare shared the main lpClient's
  // request queue, its rank() call would reject (via SupersededError) whatever scenario solve was
  // already in flight -- and since state.tsx swallows SupersededError without clearing `solve`/
  // `pending`, that control would be stuck showing "Solving..." forever, with no error and no result.
  await withWasmDelay(page, 1500);
  await page.goto("/");
  await page.locator('[data-testid="bus"][data-bus="26"]').focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Confirm removal" }).focus();
  await page.keyboard.press("Enter"); // removal solve in flight (~1.5s, shared Worker's first solve)
  await page.getByRole("button", { name: "Compare" }).click(); // Compare's own private Worker also loads its own WASM now
  await expect(page.locator('[data-testid="bus"][data-bus="26"]')).toHaveAttribute("data-state", "removed", { timeout: 10000 });
  await expect(page.getByText(/Solving/)).toHaveCount(0, { timeout: 10000 });
  await expect(page.getByTestId("cr-n-orders")).toHaveText("6", { timeout: 10000 });
});
