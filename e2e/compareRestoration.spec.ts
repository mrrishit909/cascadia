// e2e coverage for CAS-INT-006 (compare restoration) against the real production build/Worker.
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { controlHome, home } from "./helpers/placement";

async function withWasmDelay(page: Page, ms: number) {
  await page.route("**/*.wasm", async (route) => {
    if (ms) await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });
}

// Read directly from verification/REFERENCE_RESULTS/add_line_restoration.json's restoration_cases
// (derived from the Python oracle via research/evaluate/add_line_restoration.py's RESTORE dict) rather
// than hardcoding the numbers here -- a hardcoded copy can't catch the reference file itself drifting
// from a regenerated/changed Python RESTORE dict, only CompareRestoration.tsx's PRESETS drifting from
// a frozen copy of the numbers (an independent review flagged this gap: "the pin isn't real").
const refJson = JSON.parse(readFileSync(new URL("../verification/REFERENCE_RESULTS/add_line_restoration.json", import.meta.url), "utf8"));
const REFERENCE: Record<string, { n_orders: number; best_order: string; best_served: string }> = {};
for (const c of refJson.restoration_cases) {
  const best = c.ranking[0];
  REFERENCE[c.case_id] = { n_orders: c.ranking.length, best_order: best.order.join(", "), best_served: best.served_mw_steps.toFixed(2) };
}

for (const [label, ref] of Object.entries(REFERENCE)) {
  test(`pinned to the Python oracle: ${label} ranks ${ref.n_orders} orders, best is [${ref.best_order}] at ${ref.best_served}`, async ({ page }) => {
    await page.goto("/");
    await controlHome(page, "Compare restoration").locator('select').selectOption(label);
    await home(page).getByRole("button", { name: "Compare" }).click();
    await expect(home(page).getByTestId("cr-n-orders")).toHaveText(String(ref.n_orders), { timeout: 5000 });
    await expect(home(page).getByTestId("cr-best-served")).toHaveText(ref.best_served);
    await expect(controlHome(page, "Compare restoration")).toContainText(`order [${ref.best_order}]`);
  });
}

test("choosing a non-best order shows its own rank and the gap behind the best", async ({ page }) => {
  await page.goto("/");
  await home(page).getByRole("button", { name: "Compare" }).click(); // default preset: island_pocket_plus_line9
  await expect(home(page).getByTestId("cr-n-orders")).toHaveText("6", { timeout: 5000 });
  const rows = controlHome(page, "Compare restoration").locator('li button');
  await expect(rows).toHaveCount(5); // TOP_SHOWN=5 of 6 orders shown by default (rank 1 already chosen)
  await rows.nth(4).click(); // pick a lower-ranked order
  await expect(home(page).getByTestId("cr-chosen-rank")).not.toHaveText("1");
  await expect(home(page).locator('div[aria-label="Chosen order detail"]')).toContainText("behind best");
});

test("isolation: Compare's own request does not hang an unrelated control's in-flight solve", async ({ page }) => {
  // The REAL D1-class risk this isolated private Worker prevents: if Compare shared the main lpClient's
  // request queue, its rank() call would reject (via SupersededError) whatever scenario solve was
  // already in flight -- and since state.tsx swallows SupersededError without clearing `solve`/
  // `pending`, that control would be stuck showing "Solving..." forever, with no error and no result.
  await withWasmDelay(page, 1500);
  await page.goto("/");
  await page.locator('[data-testid="bus"][data-bus="26"]').focus(); // NetworkView stage, not a dual-mounted control
  await page.keyboard.press("Enter");
  await home(page).getByRole("button", { name: "Confirm removal" }).focus();
  await page.keyboard.press("Enter"); // removal solve in flight (~1.5s, shared Worker's first solve)
  await home(page).getByRole("button", { name: "Compare" }).click(); // Compare's own private Worker also loads its own WASM now
  await expect(page.locator('[data-testid="bus"][data-bus="26"]')).toHaveAttribute("data-state", "removed", { timeout: 10000 });
  await expect(page.getByText(/Solving/)).toHaveCount(0, { timeout: 10000 });
  await expect(home(page).getByTestId("cr-n-orders")).toHaveText("6", { timeout: 10000 });
});

test("keyboard-only parity: select preset, Compare, and choose an order without a mouse", async ({ page }) => {
  await page.goto("/");
  await controlHome(page, "Compare restoration").locator('select').selectOption("two_buses");
  await home(page).getByRole("button", { name: "Compare" }).focus();
  await page.keyboard.press("Enter");
  await expect(home(page).getByTestId("cr-n-orders")).toHaveText("2", { timeout: 5000 });
  const rows = controlHome(page, "Compare restoration").locator('li button');
  await rows.nth(1).focus();
  await page.keyboard.press("Enter");
  await expect(home(page).getByTestId("cr-chosen-rank")).toHaveText("2");
});
