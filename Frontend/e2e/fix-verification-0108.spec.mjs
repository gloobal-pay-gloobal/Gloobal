// Verification for the 2026-08-01 founder report.
//
//   BUG 1 — the lock screen named the wrong Gloobal ID.
//   BUG 2 — navigating back logged the person out.
//   BUG 3 — the registration Secure ID screen: the REGISTER badge, and the
//     Gloobal logo that had to come off that screen only.
//
// Every stub is scoped to the backend origin. A broader glob would also match
// the app's own Vite module URLs and break the module graph.
import { test, expect } from "@playwright/test";

const BACKEND = "https://gloobal-pay.onrender.com";
const SYMBOLS = ["−", "+", "×", "=", "○", "□", "●", "■"];
const SECURE_ID = Array.from({ length: 12 }, (_, i) => SYMBOLS[i % SYMBOLS.length]);
const SECURE_ID_STR = SECURE_ID.join(""); // −+×=○□●■−+×=

const MOBILE = "8114491364";
const OTP = "123456";
const PIN = "123456";
const SESSION_KEY = "gloobal.session.v1";

const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

const USER = {
  symbolId: SECURE_ID_STR,
  fullName: "Priya Sharma",
  mobileNumber: "+91" + MOBILE,
  referralCount: 0,
  hasPin: true,
  hasPasskey: false,
  cashbackRate: 0,
  symbolIdHistory: [],
  balance: 5000,
};

const EMPTY_SUMMARY = { success: true, count: 0, totalSent: 0, totalReceived: 0, transactions: [] };

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
    if (url.includes("/api/pin/verify")) return route.fulfill(json({ verified: true, user: USER }));
    if (url.includes("/api/login")) return route.fulfill(json({ user: USER }));
    if (url.includes("/api/referrals/")) return route.fulfill(json({ referrals: [], total: 0 }));
    if (url.includes("/api/assets/paylater/")) return route.fulfill(json({ limit: 0, available: 0, pendingDues: 0, transactions: [] }));
    if (url.includes("/api/assets/")) return route.fulfill(json({ totalAssets: 0, futureAssets: 0, seeds: [], avgYearsToTarget: 0, payLaterLimit: 0 }));
    if (url.includes("/api/users/resolve")) return route.fulfill(json({ success: true, user: USER }));
    if (url.includes("/api/profile/")) return route.fulfill(json({ user: USER }));
    if (url.includes("/api/transactions/history/")) return route.fulfill(json({ success: true, transactions: [], count: 0 }));
    if (url.includes("/api/transactions/")) return route.fulfill(json(EMPTY_SUMMARY));
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

const readSession = (page) => page.evaluate((k) => window.localStorage.getItem(k), SESSION_KEY);
const writeSession = (page, blob) =>
  page.evaluate(([k, v]) => window.localStorage.setItem(k, JSON.stringify(v)), [SESSION_KEY, blob]);

const SESSION_BLOB = { user: USER, phoneNumber: MOBILE, savedAt: Date.now(), biometricEnrolled: false };

/** Seeds a session and stops on the lock screen without unlocking it. */
async function gotoLockScreen(page, overrides) {
  await mockBackend(page, overrides);
  await page.addInitScript(
    ([k, v]) => window.localStorage.setItem(k, JSON.stringify(v)),
    [SESSION_KEY, SESSION_BLOB]
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("reauth-screen")).toBeVisible({ timeout: 30_000 });
}

/** Registration: landing screen → phone → OTP. Stops on the OTP card. */
async function gotoOtp(page, overrides) {
  await mockBackend(page, overrides);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Phone number/i }).click();
  await tapDigits(page, MOBILE);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText(/VERIFY OTP/i)).toBeVisible({ timeout: 30_000 });
}

/** Registration: all the way to the Secure ID card (isLogin=false).
 *
 * Registration checks a candidate ID with GET /api/users/resolve and keeps
 * IN disabled while it comes back taken — so the ID being created here has
 * to look free. */
async function gotoRegistrationSecureId(page) {
  await gotoOtp(page, { "/api/users/resolve": () => json({ user: null }, 404) });
  await tapDigits(page, OTP);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
}

/** The login path to the same Secure ID card: landing screen, flip to log in. */
async function gotoLoginSecureId(page, overrides) {
  await mockBackend(page, overrides);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Flip to log in/i }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
}

/** Login: Secure ID entered and submitted, landing on the PIN pad. */
async function gotoLoginAuth(page) {
  await gotoLoginSecureId(page);
  await tapSymbols(page, SECURE_ID);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText("Verify it's you")).toBeVisible({ timeout: 30_000 });
}

const backButton = (page) => page.getByRole("button", { name: "Back", exact: true });
const logoImages = (page) => page.locator('img[src*="globalid-logo"]');

// ═══ BUG 1 — the lock screen named the wrong Gloobal ID ════════════════════
//
// The session was never wrong. The *mask* was: the tail was drawn with "●",
// which is the dot symbol — a legal character in every Gloobal ID. So an
// account whose real ID was −+×=○□●■−+×= was rendered as −+×=●●●●●●●●, a
// different and perfectly valid-looking ID. The founder read exactly that.

test("B1-A: Lock screen shows the same symbolId as the profile screen", async ({ page }) => {
  await gotoLockScreen(page);

  const masked = page.getByTestId("reauth-masked-id");
  await expect(masked).toBeVisible();

  const shown = (await masked.textContent()).trim();

  // The visible half is the real account's opening symbols, unaltered.
  expect(shown.startsWith(SECURE_ID_STR.slice(0, 4))).toBe(true);
  expect(shown.slice(0, 4)).toBe("−+×=");

  // And the hidden half is masked with a character that is NOT a Gloobal
  // Symbol, so the string can never be misread as a different real ID.
  const tail = shown.slice(4);
  expect(tail).toBe("•".repeat(tail.length));
  for (const symbol of SYMBOLS) expect(tail).not.toContain(symbol);

  // The specific wrong ID the founder was shown must not come back.
  expect(shown).not.toBe("−+×=●●●●●●●●");
});

test("B1-B: symbolId in session matches profile after successful login", async ({ page }) => {
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await gotoLockScreen(page);
  await tapDigits(page, PIN);
  await page.getByRole("button", { name: "Log in", exact: true }).click();

  // Past the lock screen and onto the dashboard.
  await expect(page.getByTestId("reauth-screen")).toBeHidden({ timeout: 30_000 });

  // The tripwire added for this bug compares the session's symbolId against
  // GET /api/profile and shouts if they differ. They agree here, so it is
  // silent.
  await page.waitForTimeout(1500);
  expect(errors.filter((e) => e.includes("symbolId mismatch"))).toEqual([]);

  // The account that reached the dashboard is still the one the lock screen
  // named — the persisted identity every downstream screen reads from.
  const session = JSON.parse(await readSession(page));
  expect(session.user.symbolId).toBe(SECURE_ID_STR);
});

test("B1-C: Session is written with correct symbolId at registration", async ({ page }) => {
  await gotoRegistrationSecureId(page);

  await tapSymbols(page, SECURE_ID);
  await page.getByRole("button", { name: "IN", exact: true }).click();

  // Referral step — skipped, which is what fires POST /api/register-symbol.
  await page.getByRole("button", { name: /Skip for now/i }).click();

  // PIN step.
  await expect(page.getByText(/^PIN$/)).toBeVisible({ timeout: 30_000 });
  await tapDigits(page, PIN);
  await page.getByRole("button", { name: "Log in", exact: true }).click();

  // One-time biometric offer — skipped, landing on the dashboard.
  await page.getByRole("button", { name: /Skip for now/i }).click();

  await expect
    .poll(async () => JSON.parse((await readSession(page)) || "null")?.user?.symbolId, { timeout: 30_000 })
    .toBe(USER.symbolId);
});

// ═══ BUG 2 — navigating back logged the person out ═════════════════════════
//
// The lock screen's header arrow was wired straight to "sign in with a
// different account", which clears the session on purpose. Tapping back
// therefore signed the person out of the account they were unlocking.
//
// The three login-flow checks below seed a session *after* reaching the
// stage (a session present at load would open the lock screen instead), so
// what they actually assert is the thing that matters: no back handler in
// the flow calls clearSession.

test("B2-A: Back button on login secureId does not clear session", async ({ page }) => {
  await gotoLoginSecureId(page);
  await writeSession(page, SESSION_BLOB);

  await backButton(page).click();

  expect(await readSession(page)).not.toBeNull();
  await expect(page.getByRole("button", { name: /Phone number/i })).toBeVisible({ timeout: 30_000 });
});

test("B2-B: Back button on login PIN screen does not clear session", async ({ page }) => {
  await gotoLoginAuth(page);
  await writeSession(page, SESSION_BLOB);

  await backButton(page).click();

  expect(await readSession(page)).not.toBeNull();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
});

test("B2-C: Back button on OTP screen does not clear session", async ({ page }) => {
  await gotoOtp(page);
  await writeSession(page, SESSION_BLOB);

  await backButton(page).click();

  expect(await readSession(page)).not.toBeNull();
  await expect(page.getByRole("button", { name: /Phone number/i })).toBeVisible({ timeout: 30_000 });
});

test("B2-D: Lock/re-auth screen has NO back button", async ({ page }) => {
  await gotoLockScreen(page);

  // Nothing on this screen may look like "go back one step", because there
  // is no step behind it and the only thing it could do is sign the person
  // out.
  await expect(backButton(page)).toHaveCount(0);
  await expect(page.getByTestId("reauth-screen").getByRole("button", { name: /back/i })).toHaveCount(0);

  // The deliberate exit is still there, still spelled out.
  await expect(page.getByRole("button", { name: /Sign in with a different account/i })).toBeVisible();
});

test('B2-E: "Sign in with a different account" DOES clear session (correct behaviour)', async ({ page }) => {
  await gotoLockScreen(page);
  expect(await readSession(page)).not.toBeNull();

  await page.getByRole("button", { name: /Sign in with a different account/i }).click();

  await expect.poll(async () => await readSession(page), { timeout: 30_000 }).toBeNull();
  await expect(page.getByRole("button", { name: /Phone number/i })).toBeVisible({ timeout: 30_000 });
});

// ═══ BUG 3 — the registration Secure ID screen ═════════════════════════════
//
// The badge: already static since 77b5bbc, and these checks are the
// regression net that keeps it that way.
//
// The logo: the symbol dial is a two-sided coin whose back face is the
// Gloobal mark, and it flips there on its own after an idle stretch. That
// flip is now off on the registration face only.

test('B3-A: Registration secureId screen shows static "REGISTER" badge', async ({ page }) => {
  await gotoRegistrationSecureId(page);

  const badge = page.getByTestId("secureid-badge");
  await expect(badge).toBeVisible();
  await expect(badge).toHaveAttribute("data-badge-mode", "register");

  const before = (await badge.textContent()).trim();
  expect(before).toMatch(/register/i);

  // Longer than any animation cycle this card has ever run.
  await page.waitForTimeout(4000);

  await expect(badge).toBeVisible();
  await expect(badge).toHaveText(/register/i);
  expect((await badge.textContent()).trim()).toBe(before);
});

test('B3-B: "REGISTER" badge is visible at all times (not cycling)', async ({ page }) => {
  await gotoRegistrationSecureId(page);

  const badge = page.getByTestId("secureid-badge");
  for (let i = 0; i < 10; i++) {
    await expect(badge).toBeVisible();
    await expect(badge).toHaveText(/register/i);
    await page.waitForTimeout(500);
  }
});

test('B3-C: Login secureId screen shows "LOGIN" badge (regression)', async ({ page }) => {
  await gotoLoginSecureId(page);

  const badge = page.getByTestId("secureid-badge");
  await expect(badge).toBeVisible();
  await expect(badge).toHaveAttribute("data-badge-mode", "login");

  const before = (await badge.textContent()).trim();
  expect(before).toMatch(/login/i);

  await page.waitForTimeout(4000);

  await expect(badge).toHaveText(/login/i);
  await expect(badge).not.toHaveText(/register/i);
  expect((await badge.textContent()).trim()).toBe(before);
});

test("B3-D: Gloobal logo is NOT visible on registration secureId screen", async ({ page }) => {
  await gotoRegistrationSecureId(page);

  // showLogo={false} means the coin has no back face at all, so the mark is
  // not merely hidden — it is never mounted, and no idle flip can bring it
  // back. Waiting past the longest idle interval proves the second half.
  await expect(logoImages(page)).toHaveCount(0);
  await page.waitForTimeout(5000);
  await expect(logoImages(page)).toHaveCount(0);
});

test("B3-E: Gloobal logo IS visible on login secureId screen (regression)", async ({ page }) => {
  await gotoLoginSecureId(page);

  await expect(logoImages(page)).toHaveCount(1);
});

test("B3-F: Gloobal logo IS visible on the landing/phone screen (regression)", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page.getByAltText("Gloobal ID")).toBeVisible({ timeout: 30_000 });
});
