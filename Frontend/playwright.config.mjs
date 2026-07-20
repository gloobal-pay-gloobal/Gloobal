import { defineConfig, devices } from "@playwright/test";

// These specs drive the real backend on Render, whose free tier cold-starts
// for tens of seconds, so the timeouts here are deliberately generous and
// the suite runs single-file rather than in parallel.
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.mjs",
  fullyParallel: false,
  workers: 1,
  timeout: 240_000,
  expect: { timeout: 30_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5199",
    viewport: { width: 420, height: 900 },
    trace: "retain-on-failure",
  },
  projects: [{ name: "mobile-chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npx vite --port 5199 --strictPort",
    url: "http://localhost:5199",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
