// Design preview capture — walks every surface of the app against a mocked
// backend and writes one screenshot per screen into verify-shots/design/.
//
// This is not a test: nothing here asserts product behaviour. It exists so the
// whole design can be reviewed in one place. Each capture is best-effort — a
// screen that fails to open is reported and skipped rather than aborting the
// rest of the walk.
import { test, expect } from "@playwright/test";
import fs from "node:fs";

const BACKEND = "https://gloobal-pay.onrender.com";
const SYMBOLS = ["−", "+", "×", "=", "○", "□", "●", "■"];
const SECURE_ID = Array.from({ length: 12 }, (_, i) => SYMBOLS[i % SYMBOLS.length]);
const SECURE_ID_STR = SECURE_ID.join("");

const MOBILE = "8114491364";
const OTP = "123456";
const PIN = "123456";
const SESSION_KEY = "gloobal.session.v1";
const OUT = "verify-shots/design";

const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

const USER = {
  symbolId: SECURE_ID_STR,
  fullName: "Priya Sharma",
  mobileNumber: "+91" + MOBILE,
  referralCount: 3,
  hasPin: true,
  hasPasskey: false,
  cashbackRate: 2,
  symbolIdHistory: [],
  balance: 5000,
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
    if (url.includes("/api/pin/verify")) return route.fulfill(json({ verified: true, user: USER }));
    if (url.includes("/api/login")) return route.fulfill(json({ user: USER }));
    if (url.includes("/api/creator/cashback-rate")) return route.fulfill(json({ cashbackRate: 2 }));
    if (url.includes("/api/referrals/")) return route.fulfill(json({ referrals: [], total: 0 }));
    if (url.includes("/api/assets/paylater/")) return route.fulfill(json({ limit: 142.5, available: 142.5, pendingDues: 0, transactions: [] }));
    if (url.includes("/api/assets/")) return route.fulfill(json({ totalAssets: 0, futureAssets: 0, seeds: [], avgYearsToTarget: 0, payLaterLimit: 0 }));
    if (url.includes("/api/users/resolve")) return route.fulfill(json({ success: true, user: USER }));
    if (url.includes("/api/profile/")) return route.fulfill(json({ user: USER }));
    if (url.includes("/api/transactions/history/")) return route.fulfill(json({ success: true, transactions: [], count: 0 }));
    if (url.includes("/api/transactions/")) return route.fulfill(json({ success: true, transactions: [], count: 0, totalSent: 0, totalReceived: 0 }));
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

const SESSION_BLOB = { user: USER, phoneNumber: MOBILE, savedAt: Date.now(), biometricEnrolled: false };

const captured = [];

/** Settles animation, writes the shot, records it for the gallery manifest. */
async function shot(page, name, label) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  captured.push({ file: `${name}.png`, label });
  console.log("SHOT " + name);
}

/** Runs one capture step; a failure is logged and skipped, never fatal. */
async function step(name, label, fn, page) {
  try {
    await fn();
    await shot(page, name, label);
  } catch (err) {
    console.log("SKIP " + name + " — " + err.message.split("\n")[0]);
  }
}

async function seedSession(page) {
  await page.addInitScript(
    ([k, v]) => window.localStorage.setItem(k, JSON.stringify(v)),
    [SESSION_KEY, SESSION_BLOB]
  );
}

async function unlock(page) {
  await expect(page.getByTestId("reauth-screen")).toBeVisible({ timeout: 30_000 });
  await tapDigits(page, PIN);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toBeVisible({ timeout: 30_000 });
}

// The Face ID screen needs a synthetic capture device; a real browser would
// prompt and a headless one has no hardware at all. Playwright only allows
// launch options at file level, so every capture in this file runs with them.
test.use({
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] },
});

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true });
});

test.afterAll(() => {
  fs.writeFileSync(`${OUT}/manifest.json`, JSON.stringify(captured, null, 2));
  console.log("CAPTURED " + captured.length + " screens");
});

// ═══ Registration + login flow ═════════════════════════════════════════════

test("capture: onboarding and login screens", async ({ page }) => {
  await mockBackend(page, { "/api/users/resolve": () => json({ user: null }, 404) });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await step("01-landing-register", "Landing — register", async () => {
    await expect(page.getByRole("button", { name: /Phone number/i })).toBeVisible({ timeout: 30_000 });
  }, page);

  await step("02-landing-login", "Landing — flipped to log in", async () => {
    await page.getByRole("button", { name: /Flip to log in/i }).click();
    await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
  }, page);

  // Back to the register face for the phone/OTP walk.
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await step("03-otp", "OTP verification", async () => {
    await page.getByRole("button", { name: /Phone number/i }).click();
    await tapDigits(page, MOBILE);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page.getByText(/VERIFY OTP/i)).toBeVisible({ timeout: 30_000 });
  }, page);

  await step("04-secureid-register", "Secure ID creation", async () => {
    await tapDigits(page, OTP);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
  }, page);

  await step("05-referral", "Referral code", async () => {
    await tapSymbols(page, SECURE_ID);
    await page.getByRole("button", { name: "IN", exact: true }).click();
    await expect(page.getByRole("button", { name: /Skip for now/i })).toBeVisible({ timeout: 30_000 });
  }, page);

  await step("06-pin-setup", "PIN setup", async () => {
    await page.getByRole("button", { name: /Skip for now/i }).click();
    await expect(page.getByText(/^PIN$/)).toBeVisible({ timeout: 30_000 });
  }, page);

  await step("07-device-setup", "Device security setup", async () => {
    await tapDigits(page, PIN);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page.getByRole("button", { name: /Skip for now/i })).toBeVisible({ timeout: 30_000 });
  }, page);
});

test("capture: login path screens", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await step("08-secureid-login", "Secure ID — login", async () => {
    await page.getByRole("button", { name: /Flip to log in/i }).click();
    await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
  }, page);

  await step("09-login-pin", "Login — verify it's you", async () => {
    await tapSymbols(page, SECURE_ID);
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await expect(page.getByText("Verify it's you")).toBeVisible({ timeout: 30_000 });
  }, page);
});

test("capture: lock screen", async ({ page }) => {
  await mockBackend(page);
  await seedSession(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await step("10-lock-screen", "Lock screen (restored session)", async () => {
    await expect(page.getByTestId("reauth-screen")).toBeVisible({ timeout: 30_000 });
  }, page);
});

test("capture: face id screen", async ({ page }) => {
  await mockBackend(page);
  await seedSession(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await step("11-face-id", "Face ID", async () => {
    await expect(page.getByTestId("reauth-screen")).toBeVisible({ timeout: 30_000 });
    await page.getByTestId("reauth-face-button").click();
    await expect(page.getByTestId("face-id-screen")).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(1500);
  }, page);
});

// ═══ Signed-in surfaces ════════════════════════════════════════════════════

test("capture: dashboard and inner screens", async ({ page }) => {
  await mockBackend(page);
  await seedSession(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await unlock(page);

  await step("12-dashboard-home", "Dashboard — Home", async () => {
    await expect(page.getByRole("button", { name: "Home", exact: true })).toBeVisible({ timeout: 30_000 });
  }, page);

  await step("13-receive", "Receive — My Share", async () => {
    await page.getByRole("button", { name: "Receive", exact: true }).click();
    await expect(page.getByTestId("my-share-rate-input")).toBeVisible({ timeout: 30_000 });
  }, page);

  await step("14-receive-sheet", "Receive — share sheet", async () => {
    await page.getByTestId("my-share-rate-input").fill("2");
    await page.getByTestId("my-share-continue").click();
    await expect(page.getByText("Share this Gloobal ID to receive money")).toBeVisible({ timeout: 30_000 });
  }, page);
  await page.getByRole("button", { name: "Close", exact: true }).first().click().catch(() => {});

  await step("15-accounts", "Dashboard — Accounts", async () => {
    await page.getByRole("button", { name: "Accounts", exact: true }).click();
    await expect(page.getByRole("button", { name: "My Assets", exact: true })).toBeVisible({ timeout: 30_000 });
  }, page);

  await step("16-my-assets", "My Assets", async () => {
    await page.getByRole("button", { name: "My Assets", exact: true }).click();
    await expect(page.getByTestId("assets-empty")).toBeVisible({ timeout: 30_000 });
  }, page);
  await page.getByRole("button", { name: "Back", exact: true }).first().click().catch(() => {});

  await step("17-add-bank", "Add Bank", async () => {
    await page.getByRole("button", { name: /Add Bank/i }).first().click();
    await expect(page.getByText(/Gloobal Bank/i).first()).toBeVisible({ timeout: 30_000 });
  }, page);
  await page.getByRole("button", { name: "Back", exact: true }).first().click().catch(() => {});
  await page.getByRole("button", { name: "Close", exact: true }).first().click().catch(() => {});

  await step("18-profile", "Profile", async () => {
    await page.getByRole("button", { name: "Profile", exact: true }).click();
    await expect(page.getByTestId("profile-header")).toBeVisible({ timeout: 30_000 });
  }, page);

  await step("19-gh-score", "GH Score", async () => {
    await page.getByRole("button", { name: "My GH Score", exact: true }).click();
    await expect(page.getByTestId("gh-category-self")).toBeVisible({ timeout: 30_000 });
  }, page);

  await step("20-gh-category", "GH Score — Self category", async () => {
    await page.getByTestId("gh-category-self").click();
    await expect(page.getByTestId("gh-item-self-health")).toBeVisible({ timeout: 30_000 });
  }, page);
  await page.getByRole("button", { name: "Back", exact: true }).first().click().catch(() => {});
  await page.getByRole("button", { name: "Back", exact: true }).first().click().catch(() => {});

  await step("21-my-gloobal-id", "My Gloobal ID", async () => {
    await page.getByRole("button", { name: "My Gloobal ID", exact: true }).click();
    await expect(page.getByTestId("current-gloobal-id")).toBeVisible({ timeout: 30_000 });
  }, page);
  await page.getByRole("button", { name: "Cancel", exact: true }).first().click().catch(() => {});

  await step("22-send-money", "Send Money", async () => {
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await page.getByRole("button", { name: /^Pay$/ }).first().click();
    await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
  }, page);

  await step("23-send-money-amount", "Send Money — amount", async () => {
    await tapSymbols(page, SECURE_ID);
    await expect(page.getByTestId("recipient-found")).toBeVisible({ timeout: 30_000 });
  }, page);
});
