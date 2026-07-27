// Verification for the three 2026-07-27 founder tasks.
//
//   FIX 1 — registration OTP is blocked at step one for an already-registered
//     number (409 from POST /api/otp/send), with a "Log in instead" jump.
//   FIX 2 — the login PIN screen carries no biometrics; the Face ID /
//     Fingerprint offer is a separate screen shown *after* a correct PIN,
//     and only when no passkey exists yet.
//   FEATURE 3 — My Assets: cashback that compounds toward the amount paid,
//     its per-asset growth chart, and PayLater's limit tied to total assets.
//
// Every stub is scoped to the backend origin. A broader glob would also match
// the app's own Vite module URLs and break the module graph.
import { test, expect } from "@playwright/test";

const BACKEND = "https://gloobal-pay.onrender.com";
const SYMBOLS = ["−", "+", "×", "=", "○", "□", "●", "■"];
const SECURE_ID = Array.from({ length: 12 }, (_, i) => SYMBOLS[i % SYMBOLS.length]);
const SECURE_ID_STR = SECURE_ID.join("");

const MOBILE = "8114491364";
const PIN = "123456";

const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const bothKeys = (text) => ({ error: text, message: text });

const USER = {
  symbolId: SECURE_ID_STR,
  fullName: "+91" + MOBILE,
  mobileNumber: "+91" + MOBILE,
  referralCount: 0,
  hasPin: true,
  hasPasskey: false,
};

async function mockBackend(page, overrides = {}) {
  await page.route(`${BACKEND}/**`, async (route) => {
    const url = route.request().url();

    for (const [fragment, responder] of Object.entries(overrides)) {
      if (url.includes(fragment)) {
        const answer = await responder(route);
        if (answer) return route.fulfill(answer);
      }
    }

    if (url.includes("/api/otp/send")) return route.fulfill(json({ message: "Prototype OTP sent successfully." }));
    if (url.includes("/api/otp/verify")) return route.fulfill(json({ verified: true }));
    if (url.includes("/api/register-symbol")) return route.fulfill(json({ user: USER, referralApplied: true }, 201));
    if (url.includes("/api/pin/set")) return route.fulfill(json({ user: USER }));
    if (url.includes("/api/login")) return route.fulfill(json({ user: USER }));
    if (url.includes("/api/referrals/")) return route.fulfill(json({ referrals: [], total: 0 }));
    if (url.includes("/api/assets/paylater/")) return route.fulfill(json({ limit: 0, available: 0, pendingDues: 0, transactions: [] }));
    if (url.includes("/api/assets/")) return route.fulfill(json({ totalAssets: 0, futureAssets: 0, seeds: [], avgYearsToTarget: 0, payLaterLimit: 0 }));
    if (url.includes("/api/users/resolve")) {
      const identifier = decodeURIComponent(new URL(url).searchParams.get("identifier") || "");
      const isMobile = /^\+?\d+$/.test(identifier);
      return route.fulfill(isMobile ? json({ success: true, user: USER }) : json({ user: null }, 404));
    }
    if (url.includes("/api/profile/")) return route.fulfill(json({ user: USER }));
    if (url.includes("/api/transactions/history/")) return route.fulfill(json({ success: true, transactions: [], count: 0 }));
    if (url.includes("/api/passkey/")) return route.fulfill(json({ hasPasskey: false }));
    return route.fulfill(json({}));
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
}

const tapDigits = async (page, digits) => {
  for (const d of digits) await page.getByRole("button", { name: `Digit ${d}`, exact: true }).first().click();
};
const tapSymbols = async (page, symbols) => {
  for (const s of symbols) await page.getByRole("button", { name: `Symbol ${s}`, exact: true }).click();
};

async function gotoHome(page, overrides) {
  await mockBackend(page, overrides);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /Phone number/i })).toBeVisible({ timeout: 30_000 });
}

/** Registration path — enter a phone number and submit (fires POST /api/otp/send). */
async function submitRegistrationPhone(page) {
  await page.getByRole("button", { name: /Phone number/i }).click();
  await tapDigits(page, MOBILE);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
}

/** Login path — flip to login, enter the Secure ID, reach the PIN screen. */
async function gotoLoginPin(page, overrides) {
  await gotoHome(page, overrides);
  await page.getByRole("button", { name: /Flip to log in/i }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
  await tapSymbols(page, SECURE_ID);
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();
  await expect(page.getByText(/Verify it's you/i)).toBeVisible({ timeout: 30_000 });
}

/** Boots straight onto the dashboard by seeding the persisted session. */
async function gotoDashboard(page, overrides) {
  await mockBackend(page, overrides);
  await page.addInitScript((user) => {
    window.localStorage.setItem(
      "gloobal.session.v1",
      JSON.stringify({ user, phoneNumber: "8114491364", savedAt: Date.now() })
    );
  }, USER);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toBeVisible({ timeout: 30_000 });
}

/** Dashboard -> Accounts tab -> My Assets tile. */
async function gotoMyAssets(page, overrides) {
  await gotoDashboard(page, overrides);
  await page.getByRole("button", { name: "Accounts", exact: true }).click();
  await page.getByRole("button", { name: "My Assets", exact: true }).click();
  await expect(page.getByText("Growing toward")).toBeVisible({ timeout: 30_000 });
}

/** Dashboard -> Accounts tab -> PayLater tile. */
async function gotoPayLater(page, overrides) {
  await gotoDashboard(page, overrides);
  await page.getByRole("button", { name: "Accounts", exact: true }).click();
  await page.getByRole("button", { name: "PayLater", exact: true }).click();
  await expect(page.getByText(/Available PayLater balance/i)).toBeVisible({ timeout: 30_000 });
}

// ═══ FIX 1 — registration OTP block ════════════════════════════════════════

test("R1-A: OTP is NOT sent for an already-registered phone number during registration", async ({ page }) => {
  const already = "This number is already registered. Please log in instead.";
  await gotoHome(page, { "/api/otp/send": () => json(bothKeys(already), 409) });

  await submitRegistrationPhone(page);

  await expect(page.getByText(/This number is already registered/i)).toBeVisible({ timeout: 30_000 });
  // Never advanced to the OTP entry step.
  await expect(page.getByText(/VERIFY OTP/i)).toHaveCount(0);
});

test('R1-B: Error on step 1 includes a "Log in instead" link', async ({ page }) => {
  await gotoHome(page, { "/api/otp/send": () => json(bothKeys("This number is already registered."), 409) });
  await submitRegistrationPhone(page);
  await expect(page.getByRole("button", { name: /Log in instead/i })).toBeVisible({ timeout: 30_000 });
});

test('R1-C: Tapping "Log in instead" switches to login mode', async ({ page }) => {
  await gotoHome(page, { "/api/otp/send": () => json(bothKeys("This number is already registered."), 409) });
  await submitRegistrationPhone(page);
  await page.getByRole("button", { name: /Log in instead/i }).click();

  // Lands on the login Secure ID card — the symbol pad plus the login-only
  // "use mobile number instead" affordance — and never the OTP step.
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /Use mobile number instead|Switch to mobile/i })).toBeVisible();
  await expect(page.getByText(/VERIFY OTP/i)).toHaveCount(0);
});

test("R1-D: OTP IS sent for an unregistered phone number during registration", async ({ page }) => {
  await gotoHome(page, { "/api/otp/send": () => json({ message: "OTP sent" }) });
  await submitRegistrationPhone(page);
  await expect(page.getByText(/VERIFY OTP/i)).toBeVisible({ timeout: 30_000 });
});

// ═══ FIX 2 — biometric separation ══════════════════════════════════════════

test('F2-A: PIN screen does NOT contain the biometric link or buttons', async ({ page }) => {
  await gotoLoginPin(page);
  await expect(page.getByRole("button", { name: "Use Face ID / Fingerprint instead" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Verify with Face ID/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Verify with fingerprint/i })).toHaveCount(0);
});

test("F2-B: After correct PIN entry, the biometric offer screen appears", async ({ page }) => {
  // Default passkey status is not-enrolled, so the offer shows.
  await gotoLoginPin(page);
  await tapDigits(page, PIN);
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();

  const face = page.getByRole("button", { name: /Verify with Face ID/i });
  const finger = page.getByRole("button", { name: /Verify with fingerprint/i });
  await expect(face).toBeVisible({ timeout: 30_000 });
  await expect(finger).toBeVisible();
  await expect(page.getByRole("button", { name: /Skip for now/i })).toBeVisible();

  // Icon circles are the large post-PIN size (88px), well over 80.
  const circle = face.locator("span").first();
  const box = await circle.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(80);
  expect(box.height).toBeGreaterThanOrEqual(80);
});

test('F2-C: "Skip for now" goes to the dashboard', async ({ page }) => {
  await gotoLoginPin(page);
  await tapDigits(page, PIN);
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();
  await expect(page.getByRole("button", { name: /Skip for now/i })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Skip for now/i }).click();
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toBeVisible({ timeout: 30_000 });
});

test("F2-D: If biometrics already enrolled, dashboard shows directly after PIN", async ({ page }) => {
  await gotoLoginPin(page, { "/api/passkey/status": () => json({ hasPasskey: true }) });
  await tapDigits(page, PIN);
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();

  await expect(page.getByRole("button", { name: "Profile", exact: true })).toBeVisible({ timeout: 30_000 });
  // The offer screen was skipped entirely.
  await expect(page.getByRole("button", { name: /Verify with Face ID/i })).toHaveCount(0);
});

// ═══ FEATURE 3 — My Assets ═════════════════════════════════════════════════

test("MA-A: My Assets is accessible from the dashboard", async ({ page }) => {
  await gotoDashboard(page);
  await page.getByRole("button", { name: "Accounts", exact: true }).click();
  await expect(page.getByRole("button", { name: "My Assets", exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "My Assets", exact: true }).click();
  await expect(page.getByText("Growing toward")).toBeVisible({ timeout: 30_000 });
});

test("MA-B: Total card shows totalAssets and futureAssets", async ({ page }) => {
  await gotoMyAssets(page);
  // Demo seeds carry real value, so the total is not zero.
  await expect(page.getByText("Growing toward")).toBeVisible();
  await expect(page.getByText(/Growing toward .*[1-9]/)).toBeVisible();
});

test("MA-C: Rate strip shows three tiles with correct labels", async ({ page }) => {
  await gotoMyAssets(page);
  await expect(page.getByText("0–7%")).toBeVisible();
  await expect(page.getByText("1%/mo")).toBeVisible();
  await expect(page.getByText("Monthly")).toBeVisible();
});

test('MA-D: Only 4 seed rows by default; "View all" expands the list', async ({ page }) => {
  await gotoMyAssets(page);
  await expect(page.getByTestId("asset-seed-row")).toHaveCount(4);
  const viewAll = page.getByRole("button", { name: /View all spending \(5\)/i });
  await expect(viewAll).toBeVisible();
  await viewAll.click();
  await expect(page.getByTestId("asset-seed-row")).toHaveCount(5);
  await expect(page.getByRole("button", { name: /Show less/i })).toBeVisible();
});

test("MA-E: Average time card shows years, not months", async ({ page }) => {
  await gotoMyAssets(page);
  await page.getByRole("button", { name: /View all spending/i }).click();
  const card = page.getByText(/Average time to fully compound/i);
  await expect(card).toBeVisible();
  const value = page.locator("text=/\\d+\\.\\d yr/").first();
  await expect(value).toBeVisible();
});

test("MA-F: Per-seed time column shows years, not months", async ({ page }) => {
  await gotoMyAssets(page);
  const firstRow = page.getByTestId("asset-seed-row").first();
  await expect(firstRow).toContainText(/\d+\.\d yr/);
  const rowText = await firstRow.textContent();
  expect(rowText).not.toMatch(/\bmo\b/);
});

test("MA-G: Tapping a seed row opens the growth chart detail", async ({ page }) => {
  await gotoMyAssets(page);
  await page.getByTestId("asset-seed-row").first().click();
  await expect(page.getByText("Today")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/full/i).first()).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByText(/Assets from spending/i)).toBeVisible({ timeout: 30_000 });
});

test("MA-H: PayLater limit equals totalAssets", async ({ page }) => {
  await gotoPayLater(page, {
    "/api/assets/paylater/": () => json({ limit: 142.5, available: 142.5, pendingDues: 0, transactions: [] }),
  });
  await expect(page.getByText(/142\.50/).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/your current assets/i)).toBeVisible();
});

test("MA-I: PayLater screen cross-links to My Assets", async ({ page }) => {
  await gotoPayLater(page);
  const link = page.getByRole("button", { name: /View My Assets/i });
  await expect(link).toBeVisible({ timeout: 30_000 });
  await link.click();
  await expect(page.getByText("Growing toward")).toBeVisible({ timeout: 30_000 });
});

test("MA-J: Demo-data badge is shown when no real seeds exist", async ({ page }) => {
  await gotoMyAssets(page, {
    "/api/assets/paylater/": () => json({ limit: 0, available: 0, pendingDues: 0, transactions: [] }),
    "/api/assets/": () => json({ totalAssets: 0, futureAssets: 0, seeds: [], avgYearsToTarget: 0, payLaterLimit: 0 }),
  });
  await expect(page.getByText("Demo data", { exact: true })).toBeVisible({ timeout: 30_000 });
  // Demo seed rows are actually rendered.
  await expect(page.getByTestId("asset-seed-row").first()).toBeVisible();
});
