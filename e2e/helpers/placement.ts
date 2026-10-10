import { expect, type Locator, type Page } from "@playwright/test";

// Locator-migration prep (docs/planning/cascadia/CHAPTER_ARCHITECTURE.md): each of the 7 interaction
// controls now accepts a `placement: 'home' | 'lab'` prop (default 'home') and renders it as
// `data-placement` on its root <section>. Today only the 'home' placement is ever mounted (the chapter
// shell doesn't exist yet), but every control-internal selector (testids, bare role queries, select/
// slider lookups) is NOT globally unique -- it was never meant to be, since two placements of the same
// control render the identical markup. Scoping every control-internal locator through `home(page)`
// here, rather than loosely on `page`, is what keeps today's tests passing AND keeps them correct once
// a second ('lab') placement exists: `home(page).getByTestId('unserved-mw')` only ever matches the
// home-chapter instance, never the lab's.
//
// NetworkView's bus/line/candidate-line testids and the app-level singletons (StatusRegion,
// RestorationStatusRegion, ResetButton, .provenance) are NOT scoped here -- they live outside any
// dual-mounted control and only ever render once regardless of how many control placements exist
// (see CHAPTER_ARCHITECTURE.md section 2: the stage is the one canonical interactive NetworkView).
export const home = (page: Page): Locator => page.locator('[data-placement="home"]');
export const lab = (page: Page): Locator => page.locator('[data-placement="lab"]');

// `home(page)` resolves directly to the 7 `<section data-placement="home">` root elements themselves
// (there is no separate wrapper) -- so `home(page).locator('section:has-text("X") ...')` is a bug, not
// a disambiguator: it looks for a SECOND, nested <section> matching that selector inside each of those
// 7 already-section-level roots, which never exists, and the locator resolves to zero elements every
// time. Caught by running the full suite after the locator migration: every test using that pattern
// failed with "element(s) not found" (addLine/compareRestoration/dualMount/newControls/touch.spec.ts,
// 29 tests), while tests using plain `home(page).getByRole(...)`/`getByTestId(...)` passed, since those
// search WITHIN the 7 matched sections' descendants rather than for a nested <section>.
// `controlHome(page, label)` is the correct replacement: filter the 7 home sections down to the one
// whose text content matches `label`, then query inside that single result.
export const controlHome = (page: Page, label: string): Locator => home(page).filter({ hasText: label });
// Same fix, for the 'lab' placement (chapter 6, App.tsx).
export const controlLab = (page: Page, label: string): Locator => lab(page).filter({ hasText: label });

// Chapter shell: the persistent stage shows each chapter's own STORY fixture until that chapter's
// hosted control(s) diverge from baseline (CHAPTER_ARCHITECTURE.md section 3) -- so a test asserting on
// the shared `[data-testid="bus"]`/`[data-testid="line"]` stage elements (not a control's own readout,
// which always shows live truth regardless of active chapter) must first navigate to the chapter whose
// control it just used, the same way a real user would actually be scrolled there. Scrolls the chapter
// section into view and waits for the real IntersectionObserver to report it active.
export async function scrollToChapter(page: Page, id: string) {
  await page.locator(`#${id}`).scrollIntoViewIfNeeded();
  await expect(page.locator(".stage-sticky")).toHaveAttribute("data-active-chapter", id, { timeout: 5000 });
}
