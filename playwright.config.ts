import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  webServer: {
    // Builds fresh and refuses to reuse a stale server: reuseExistingServer:true previously let a
    // leftover preview process (from an earlier manually-rebuilt dist) silently serve OLD code to a
    // test run, producing at least one confirmed false pass during development (a mutation check
    // "passed" against code that had already been fixed). --strictPort means a port conflict fails
    // loudly instead of silently reusing whatever's already listening.
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    port: 4173,
    reuseExistingServer: false,
    timeout: 60000,
  },
  use: {
    baseURL: "http://localhost:4173",
  },
});
