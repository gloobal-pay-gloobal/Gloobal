// Coverage for the session-persistence fix. The backend is mocked so this
// runs fast and deterministically without creating real accounts.
//
// Before the fix, `stage` and `registeredUser` lived only in React state,
// so any remount (a plain page reload, a PWA relaunch, a service-worker
// update reload) reset the app to the phone screen — experienced as
// "it logs me out on refresh" / "it auto-logs-out". These tests reload
// mid-session and assert the session is restored, and that an explicit
// logout is NOT restored.
//
// Updated 2026-07-31: a restored session now reopens on the lock screen
// ("Verify it's you") rather than the dashboard — restoring *which*
// account is signed in is not the same as proving it is still the same
// person holding the phone. "Restored" below therefore means "reaches the
// lock screen naming this account", and the dashboard assertions moved
// behind a PIN unlock.
import { test, expect } from "@playwright/test";

const BACKEND = "https://gloobal-pay.onrender.com";
const SYMBOLS = ["−", "+", "×", "=", "○", "□", "●", "■"];
const SECURE_ID = Array.from({ length: 12 }, (_, i) => SYMBOLS[i % SYMBOLS.length]);
const MOBILE = "9876543210";
const OTP = "123456";
const PIN = "123456";

const json = (b, s = 200) => ({ status: s, contentType: "application/json", body: JSON.stringify(b) });
const USER = { symbolId: SECURE_ID.join(""), fullName: "Session Test", mobileNumber: "+91" + MOBILE, referralCount: 2, hasPin: true, hasPasskey: false };

async function mockBackend(page) {
  await page.route(`${BACKEND}/**`, (r) => {
    const u = r.request().url();
    if (u.includes("/api/otp/send")) return r.fulfill(json({ message: "sent" }));
    if (u.includes("/api/otp/verify")) return r.fulfill(json({ verified: true }));
    if (u.includes("/api/register-symbol")) return r.fulfill(json({ user: USER }, 201));
    if (u.includes("/api/pin/set")) return r.fulfill(json({ user: USER }));
    if (u.includes("/api/login")) return r.fulfill(json({ user: USER }));
    if (u.includes("/api/pin/verify")) return r.fulfill(json({ verified: true }));
    if (u.includes("/api/profile/")) return r.fulfill(json({ user: USER }));
    if (u.includes("/api/transactions/history/")) return r.fulfill(json({ success: true, transactions: [], count: 0 }));
    return r.fulfill(json({}));
  });
}

const digits = async (page, d) => { for (const x of d) await page.getByRole("button", { name: `Digit ${x}`, exact: true }).first().click(); };
const syms = async (page, s) => { for (const x of s) await page.getByRole("button", { name: `Symbol ${x}`, exact: true }).click(); };

/** Registers through to the dashboard and leaves the page there. */
async function registerToDashboard(page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Phone number/i }).click();
  await digits(page, MOBILE);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText(/VERIFY OTP/i)).toBeVisible({ timeout: 30_000 });
  await digits(page, OTP);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
  await syms(page, SECURE_ID);
  await page.getByRole("button", { name: "IN", exact: true }).click();
  await expect(page.getByRole("button", { name: /Skip for now/i })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Skip for now/i }).click();
  await expect(page.getByText("0/6")).toBeVisible({ timeout: 30_000 });
  await digits(page, PIN);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText(/Set up device security/i)).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Skip for now/i }).click();
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toBeVisible({ timeout: 30_000 });
}

/** Unlocks the lock screen with the PIN and waits for the dashboard. */
async function unlockWithPin(page) {
  await expect(page.getByText("Verify it's you")).toBeVisible({ timeout: 30_000 });
  await digits(page, PIN);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toBeVisible({ timeout: 30_000 });
}

test.describe("session persistence", () => {
  test.beforeEach(async ({ page }) => {
    await mockBackend(page);
  });

  test("the session survives a page reload and reopens on the lock screen", async ({ page }) => {
    await registerToDashboard(page);

    const stored = await page.evaluate(() => localStorage.getItem("gloobal.session.v1"));
    expect(stored).toContain(SECURE_ID.join(""));

    await page.reload({ waitUntil: "domcontentloaded" });
    // The original bug: this used to show the phone screen, throwing away
    // the session entirely. It must not do that — but it must not hand
    // over the dashboard either.
    await expect(page.getByTestId("reauth-screen")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /Phone number/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Profile", exact: true })).toHaveCount(0);

    await unlockWithPin(page);
  });

  test("the session survives repeated reloads", async ({ page }) => {
    await registerToDashboard(page);
    for (let i = 0; i < 3; i++) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await unlockWithPin(page);
    }
  });

  test("logout clears the session and reload does not sign back in", async ({ page }) => {
    await registerToDashboard(page);

    await page.getByRole("button", { name: "Profile", exact: true }).click();
    await page.getByRole("button", { name: "Exit", exact: true }).click();
    await expect(page.getByRole("button", { name: /Phone number/i })).toBeVisible({ timeout: 30_000 });

    const stored = await page.evaluate(() => localStorage.getItem("gloobal.session.v1"));
    expect(stored).toBeNull();

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /Phone number/i })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Profile", exact: true })).toHaveCount(0);
  });

  test("a corrupt stored session is ignored, not crashed on", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.setItem("gloobal.session.v1", "{not valid json"));
    await page.reload({ waitUntil: "domcontentloaded" });
    // Falls back to the phone screen instead of throwing.
    await expect(page.getByRole("button", { name: /Phone number/i })).toBeVisible({ timeout: 30_000 });
    const cleared = await page.evaluate(() => localStorage.getItem("gloobal.session.v1"));
    expect(cleared).toBeNull();
  });
});
