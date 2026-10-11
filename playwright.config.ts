import { defineConfig } from "@playwright/test";

// PW_PORT moves the preview off 4173 when another project on the machine is using it.
const PORT = Number(process.env.PW_PORT ?? 4173);

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    // Builds fresh and refuses to reuse a stale server: reuseExistingServer:true previously let a
    // leftover preview process (from an earlier manually-rebuilt dist) silently serve OLD code to a
    // test run, producing at least one confirmed false pass during development (a mutation check
    // "passed" against code that had already been fixed). --strictPort means a port conflict fails
    // loudly instead of silently reusing whatever's already listening.
    command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 60000,
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Chapter shell: `docs/ART_DIRECTION.md`'s reduced-motion rule loads the intro's FINAL frame
    // directly (no 12s beat sequence) and swaps every chapter transition instantly. Defaulting every
    // test to this is deliberate, not a weakened suite: without it, every existing test that goes
    // straight to a control (e.g. `page.goto("/")` then immediately selecting a bus) would race a
    // multi-second intro animation that has nothing to do with what it's testing. Motion-specific specs
    // that need to exercise the real GSAP timelines opt OUT explicitly with
    // `test.use({ reducedMotion: "no-preference" })` at the top of that file.
    reducedMotion: "reduce",
  },
  // The three engines CI runs (one matrix job each: `--project=<name>`).
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
});
