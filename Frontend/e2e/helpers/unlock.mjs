import { expect } from "@playwright/test";

// Every suite reaches the dashboard the same way: seed `gloobal.session.v1`
// and load the app. From 2026-07-31 that no longer lands on the dashboard —
// a restored session opens the lock screen, and the dashboard is behind a
// passkey or a PIN.
//
// This is the fixture-level answer to that. It is not a test of the lock
// screen (fix-verification-3107 covers it properly); it is the step every
// other suite now has to walk through to get where it was going.
//
// Headless Chromium reports no platform authenticator, so the lock screen
// opens straight on the PIN pad — no passkey prompt to dismiss. The suite's
// backend mock must answer POST /api/pin/verify with { verified: true }.

export async function unlockRestoredSession(page, pin = "123456") {
  await expect(page.getByTestId("reauth-screen")).toBeVisible({ timeout: 30_000 });
  for (const digit of pin) {
    await page.getByRole("button", { name: `Digit ${digit}`, exact: true }).first().click();
  }
  await page.getByRole("button", { name: "Log in", exact: true }).click();
}
