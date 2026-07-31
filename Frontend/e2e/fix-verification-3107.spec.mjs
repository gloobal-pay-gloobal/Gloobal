// Verification for the 2026-07-31 founder tasks.
//
//   TASK 1 — the Secure ID card's badge names the job it is doing, and holds
//     still long enough to be read.
//   TASK 2 — a restored session opens a lock screen, not the dashboard; and
//     registration offers biometrics after the PIN.
//   TASK 3 — GH Score: the ring, the four pillars, the permanent Finance
//     lock, and a score that reveals itself. The colour wheel and the port
//     itself are blocked on GHScore_jsx__1_.txt, which has still not
//     arrived — see the note above the T3 block.
//   TASK 4 — ID history: full HH:MM:SS timestamps, created vs changed.
//   TASK 5 — the receipt matches the reference: separate Date and Time rows,
//     a Via row, and a route from the planted seed to My Assets.
//   TASK 6 — the Accounts tab tiles are in the requested order.
//
// Every stub is scoped to the backend origin. A broader glob would also match
// the app's own Vite module URLs and break the module graph.
import { test, expect } from "@playwright/test";
import { unlockRestoredSession } from "./helpers/unlock.mjs";

const BACKEND = "https://gloobal-pay.onrender.com";
const SYMBOLS = ["−", "+", "×", "=", "○", "□", "●", "■"];
const SECURE_ID = Array.from({ length: 12 }, (_, i) => SYMBOLS[i % SYMBOLS.length]);
const SECURE_ID_STR = SECURE_ID.join("");

const OTHER_ID = Array.from({ length: 12 }, (_, i) => SYMBOLS[(i + 3) % SYMBOLS.length]);
const OTHER_ID_STR = OTHER_ID.join("");

const MOBILE = "8114491364";
const OTP = "123456";
const PIN = "123456";

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

const RECIPIENT = {
  symbolId: OTHER_ID_STR,
  fullName: "Rahul Verma",
  mobileNumber: "+918114491364",
  referralCount: 0,
  hasPin: true,
  hasPasskey: false,
  cashbackRate: 0.01,
  balance: 2000,
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
    if (url.includes("/api/symbol/check")) return route.fulfill(json({ available: true }));
    if (url.includes("/api/referrals/")) return route.fulfill(json({ referrals: [], total: 0 }));
    if (url.includes("/api/assets/paylater/")) return route.fulfill(json({ limit: 0, available: 0, pendingDues: 0, transactions: [] }));
    if (url.includes("/api/assets/")) return route.fulfill(json({ totalAssets: 0, futureAssets: 0, seeds: [], avgYearsToTarget: 0, payLaterLimit: 0 }));
    if (url.includes("/api/users/resolve")) {
      const identifier = decodeURIComponent(new URL(url).searchParams.get("identifier") || "");
      if (identifier === OTHER_ID_STR) return route.fulfill(json({ success: true, user: RECIPIENT }));
      if (identifier === SECURE_ID_STR || /^\+?\d+$/.test(identifier)) return route.fulfill(json({ success: true, user: USER }));
      return route.fulfill(json({ user: null }, 404));
    }
    if (url.includes("/api/transactions/send")) {
      return route.fulfill(json({
        success: true,
        transaction: { id: "txn-a1b2c3d4e5f6", referenceId: "GLOOBAL-TXN-0001", createdAt: new Date().toISOString() },
        newBalance: 4000,
        cashback: 10,
        cashbackRate: 0.01,
        payeeReceives: 990,
      }, 201));
    }
    if (url.includes("/api/profile/")) return route.fulfill(json({ user: USER }));
    if (url.includes("/api/transactions/history/")) return route.fulfill(json({ success: true, transactions: [], count: 0 }));
    if (url.includes("/api/transactions/")) return route.fulfill(json(EMPTY_SUMMARY));
    if (url.includes("/api/passkey/")) return route.fulfill(json({ hasPasskey: false }));
    return route.fulfill(json({}));
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
}

const tapSymbols = async (page, symbols) => {
  for (const s of symbols) await page.getByRole("button", { name: `Symbol ${s}`, exact: true }).click();
};
const tapDigits = async (page, digits) => {
  for (const d of digits) await page.getByRole("button", { name: `Digit ${d}`, exact: true }).first().click();
};
const tapPinSheet = async (page, pin) => {
  for (const d of pin) await page.locator("button.pin-key", { hasText: new RegExp(`^${d}$`) }).first().click();
};

/** Seeds a session and stops on the lock screen without unlocking it. */
async function gotoLockScreen(page, overrides, session = {}) {
  await mockBackend(page, overrides);
  await page.addInitScript((blob) => {
    window.localStorage.setItem("gloobal.session.v1", JSON.stringify(blob));
  }, { user: USER, phoneNumber: MOBILE, savedAt: Date.now(), biometricEnrolled: false, ...session });
  await page.goto("/", { waitUntil: "domcontentloaded" });
}

/** Seeds a session, unlocks it, and lands on the dashboard. */
async function gotoDashboard(page, overrides, initScript) {
  await mockBackend(page, overrides);
  await page.addInitScript((blob) => {
    window.localStorage.setItem("gloobal.session.v1", JSON.stringify(blob));
  }, { user: USER, phoneNumber: MOBILE, savedAt: Date.now(), biometricEnrolled: false });
  if (typeof initScript === "function") await page.addInitScript(initScript);
  else if (initScript) await page.addInitScript(initScript.fn, initScript.arg);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await unlockRestoredSession(page, PIN);
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toBeVisible({ timeout: 30_000 });
}

async function gotoProfile(page, overrides, initScript) {
  await gotoDashboard(page, overrides, initScript);
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(page.getByTestId("profile-header")).toBeVisible({ timeout: 30_000 });
}

async function gotoChangeId(page, overrides, initScript) {
  await gotoProfile(page, overrides, initScript);
  await page.getByRole("button", { name: "My Gloobal ID", exact: true }).click();
  await expect(page.getByTestId("current-gloobal-id")).toBeVisible({ timeout: 30_000 });
}

async function gotoGHScore(page, overrides, initScript) {
  await gotoProfile(page, overrides, initScript);
  await page.getByRole("button", { name: "My GH Score", exact: true }).click();
  await expect(page.getByTestId("gh-category-self")).toBeVisible({ timeout: 30_000 });
}

/** Walks a brand-new account from the landing screen to the Secure ID step.
 *
 * Registration checks a candidate ID with GET /api/users/resolve and keeps
 * IN disabled while it comes back taken — so the default mock, which knows
 * SECURE_ID_STR, has to be told this ID is free here. */
async function gotoRegistrationSecureId(page) {
  await mockBackend(page, {
    "/api/users/resolve": () => json({ user: null }, 404),
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Phone number/i }).click();
  await tapDigits(page, MOBILE);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText(/VERIFY OTP/i)).toBeVisible({ timeout: 30_000 });
  await tapDigits(page, OTP);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
}

/** The login path to the same Secure ID card: landing screen, flip to log in. */
async function gotoLoginSecureId(page) {
  await mockBackend(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Flip to log in/i }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
}

/** Drives a payment all the way to the PIN sheet and submits it. */
async function completePayment(page) {
  await page.getByRole("button", { name: /^Pay$/ }).first().click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
  await tapSymbols(page, OTHER_ID);
  await page.getByRole("button", { name: /^Search/ }).click();

  const payNow = page.locator("button.send-btn");
  await expect(payNow).toBeVisible({ timeout: 30_000 });
  await payNow.click();
  await page.getByRole("button", { name: "Gloobal Bank", exact: true }).click();
  await tapPinSheet(page, PIN);
}

// ═══ TASK 1 — the Secure ID badge ══════════════════════════════════════════
//
// The badge was never absent. It cycled through ["Register","Gloobal","Id"],
// so the verb was on screen a third of the time and the founder kept looking
// during the other two thirds. The checks that matter are therefore about it
// holding still, not about it existing.

test("T1-A: the registration Secure ID card is badged REGISTER", async ({ page }) => {
  await gotoRegistrationSecureId(page);

  const badge = page.getByTestId("secureid-badge");
  await expect(badge).toBeVisible();
  await expect(badge).toHaveAttribute("data-badge-mode", "register");
  await expect(badge).toHaveText(/register/i);
  // The wordmark that carries the rest of the name.
  await expect(page.getByText("Gloobal ID", { exact: true }).first()).toBeVisible();
});

test("T1-B: the badge still reads REGISTER three seconds later", async ({ page }) => {
  await gotoRegistrationSecureId(page);

  const badge = page.getByTestId("secureid-badge");
  await expect(badge).toHaveText(/register/i);
  // Longer than the 2.6s rotation that used to run here. This is the whole
  // bug: the old badge would be showing "Gloobal" or "Id" by now.
  await page.waitForTimeout(3200);
  await expect(badge).toHaveText(/register/i);
});

test("T1-C: the login Secure ID card is badged LOGIN, never REGISTER", async ({ page }) => {
  await gotoLoginSecureId(page);

  const badge = page.getByTestId("secureid-badge");
  await expect(badge).toBeVisible();
  await expect(badge).toHaveAttribute("data-badge-mode", "login");
  await expect(badge).toHaveText(/login/i);
  await expect(badge).not.toHaveText(/register/i);
  await expect(page.locator('[data-badge-mode="register"]')).toHaveCount(0);
});

test("T1-D: both badges are the same control, styled identically", async ({ page }) => {
  const read = async () =>
    page.getByTestId("secureid-badge").evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, size: s.fontSize, weight: s.fontWeight, color: s.color, radius: s.borderRadius };
    });

  await gotoRegistrationSecureId(page);
  const register = await read();

  await gotoLoginSecureId(page);
  const login = await read();

  expect(login).toEqual(register);
});

// ═══ TASK 2 — the lock screen ══════════════════════════════════════════════

test("T2-A: re-opening the app lands on the lock screen, not the dashboard", async ({ page }) => {
  await gotoLockScreen(page);

  await expect(page.getByTestId("reauth-screen")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Verify it's you")).toBeVisible();
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("balance-amount")).toHaveCount(0);
});

test("T2-B: the lock screen names the account without spelling out the ID", async ({ page }) => {
  await gotoLockScreen(page);

  const masked = page.getByTestId("reauth-masked-id");
  await expect(masked).toBeVisible();

  const shown = (await masked.innerText()).trim();
  // First four symbols, then dots — enough to recognise, not enough to copy.
  expect(shown.startsWith(SECURE_ID_STR.slice(0, 4))).toBe(true);
  expect(shown).toContain("●");
  expect(shown).not.toBe(SECURE_ID_STR);
});

test("T2-C: the right PIN unlocks it", async ({ page }) => {
  await gotoLockScreen(page);
  await unlockRestoredSession(page, PIN);
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("reauth-screen")).toHaveCount(0);
});

test("T2-D: a wrong PIN does not", async ({ page }) => {
  await gotoLockScreen(page, {
    "/api/pin/verify": () => json({ verified: false, message: "Incorrect PIN." }, 401),
  });

  await expect(page.getByTestId("reauth-screen")).toBeVisible({ timeout: 30_000 });
  await tapDigits(page, "999999");
  await page.getByRole("button", { name: "Log in", exact: true }).click();

  await expect(page.getByTestId("reauth-screen")).toBeVisible();
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toHaveCount(0);
});

test('T2-E: "different account" clears the session and returns to the phone screen', async ({ page }) => {
  await gotoLockScreen(page);
  await expect(page.getByTestId("reauth-screen")).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: /Sign in with a different account/i }).click();

  await expect(page.getByRole("button", { name: /Phone number/i })).toBeVisible({ timeout: 30_000 });
  const stored = await page.evaluate(() => localStorage.getItem("gloobal.session.v1"));
  expect(stored).toBeNull();
});

test("T2-F: an expired session is not offered for unlocking at all", async ({ page }) => {
  // 31 days old — past the 30-day cut-off.
  await gotoLockScreen(page, undefined, { savedAt: Date.now() - 31 * 24 * 60 * 60 * 1000 });

  await expect(page.getByRole("button", { name: /Phone number/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("reauth-screen")).toHaveCount(0);
});

test("T2-G: registration offers biometrics after the PIN, before the dashboard", async ({ page }) => {
  await gotoRegistrationSecureId(page);
  await tapSymbols(page, SECURE_ID);
  await page.getByRole("button", { name: "IN", exact: true }).click();

  // Referral step — skipped, it is not what this check is about.
  await expect(page.getByRole("button", { name: /Skip for now/i })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Skip for now/i }).click();

  await expect(page.getByText("0/6")).toBeVisible({ timeout: 30_000 });
  await tapDigits(page, PIN);
  await page.getByRole("button", { name: "Log in", exact: true }).click();

  await expect(page.getByText(/Set up device security/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Verify with Face ID" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Verify with fingerprint" })).toBeVisible();
  // And the dashboard is genuinely still behind it.
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toHaveCount(0);
});

// ═══ TASK 3 — GH Score ═════════════════════════════════════════════════════
//
// PARTIAL. GHScore_jsx__1_.txt has still not been delivered, so the port did
// not happen and there is no colour wheel to open — that check lives, still
// skipped, in fix-verification-3007. What is below covers the behaviour the
// component in the repo does have, plus the auto-reveal added on 2026-07-31.

// The real item keys, straight out of GH_CATEGORIES. Finance is the only
// pillar whose items are math rather than yes/no, and its answers are shaped
// differently, so the two are seeded separately.
const GH_YESNO_KEYS = [
  "self-rest", "self-movement", "self-mind",
  "community-contact", "community-help", "community-local",
  "environment-travel", "environment-waste", "environment-energy",
];
const GH_MATH_KEYS = ["finance-budget", "finance-saving", "finance-repay"];

/** Marks every check-in answered for today, so the score is complete. */
const seedAllAnswers = (symbolId) => ({
  fn: (payload) => {
    // Mirrors the component's own day index: whole days since the epoch.
    const day = Math.floor(Date.now() / 86_400_000);
    const at = new Date().toISOString();
    const answers = {};
    for (const key of payload.yesno) answers[key] = { type: "yesno", value: true, day, at };
    for (const key of payload.math) answers[key] = { type: "math", value: 1, correct: true, day, at };
    window.localStorage.setItem(`gloobal.ghAnswers.${payload.symbolId}`, JSON.stringify(answers));
  },
  arg: { symbolId, yesno: GH_YESNO_KEYS, math: GH_MATH_KEYS },
});

test("T3-A: the categories screen draws the score ring", async ({ page }) => {
  await gotoGHScore(page);
  const ring = page.locator('svg[role="img"][aria-label*="out of 100"]');
  await expect(ring.first()).toBeVisible();
  // An arc, not a bare circle: the progress track is stroke-dashed.
  await expect(ring.first().locator("circle[stroke-dasharray]")).toHaveCount(1);
});

test("T3-B: all four pillars are listed, each with its own progress", async ({ page }) => {
  await gotoGHScore(page);
  for (const key of ["self", "community", "environment", "finance"]) {
    await expect(page.getByTestId(`gh-category-${key}`)).toBeVisible();
    await expect(page.getByTestId(`gh-progress-${key}`)).toContainText("/3");
  }
  await expect(page.getByTestId("gh-progress")).toContainText("of 12");
});

test("T3-C: BLOCKED — no colour wheel exists to open", async ({ page }) => {
  await gotoGHScore(page);
  // Asserting the gap rather than pretending it is closed. When
  // GHScore_jsx__1_.txt lands and the wheel is ported, this check flips to
  // opening it and T8-C in fix-verification-3007 comes off skip.
  await expect(page.getByTestId("gh-color-wheel")).toHaveCount(0);
});

test("T3-D: a Finance check-in locks permanently, and stays locked over a reload", async ({ page }) => {
  await gotoGHScore(page);
  await page.getByTestId("gh-category-finance").click();
  await page.getByTestId("gh-item-finance-budget").click();
  // Finance check-ins are arithmetic, not yes/no — the answer's correctness
  // affects the score but not the lock, which is what is under test here.
  await page.getByLabel("Your answer").fill("1234");
  await page.getByTestId("gh-submit-math").click();

  await expect(page.getByTestId("gh-lock-finance-budget")).toBeVisible();
  await expect(page.getByTestId("gh-item-finance-budget")).toBeDisabled();

  await page.reload({ waitUntil: "domcontentloaded" });
  await unlockRestoredSession(page, PIN);
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "My GH Score", exact: true }).click();
  await page.getByTestId("gh-category-finance").click();

  await expect(page.getByTestId("gh-lock-finance-budget")).toBeVisible();
  await expect(page.getByTestId("gh-item-finance-budget")).toBeDisabled();
});

test("T3-E: the score reveals itself, with no Generate button anywhere", async ({ page }) => {
  await gotoProfile(page, undefined, seedAllAnswers(SECURE_ID_STR));
  await page.getByRole("button", { name: "My GH Score", exact: true }).click();

  // Straight to the result — nothing was tapped to ask for it.
  await expect(page.getByTestId("gh-tier")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('svg[role="img"][aria-label*="out of 100"]').first()).toBeVisible();
  await expect(page.getByTestId("gh-generate")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Generate/i })).toHaveCount(0);
});

// ═══ TASK 4 — ID history ═══════════════════════════════════════════════════

const seedHistory = (symbolId, entries) => ({
  fn: (payload) => {
    window.localStorage.setItem(`gloobal.idHistory.${payload.symbolId}`, JSON.stringify(payload.entries));
  },
  arg: { symbolId, entries },
});

const CHANGED_ENTRY = {
  symbolId: OTHER_ID_STR,
  action: "changed",
  createdAt: "2026-07-30T12:23:23.000Z",
  replacedBy: SECURE_ID_STR,
};

const CREATED_ENTRY = {
  symbolId: OTHER_ID_STR,
  action: "created",
  createdAt: "2026-07-28T09:05:41.000Z",
  replacedBy: null,
};

test("T4-A: a history row carries the time down to the second", async ({ page }) => {
  await gotoChangeId(page, undefined, seedHistory(SECURE_ID_STR, [CHANGED_ENTRY]));
  await page.getByTestId("id-history-button").click();

  const row = page.getByTestId("id-history-row").first();
  await expect(row).toBeVisible();
  await expect(row).toContainText("30 Jul 2026");
  // Rendered in local time, so the clock face is not asserted — only that
  // seconds are there at all, which is the thing that was missing.
  await expect(row).toContainText(/\d{2}:\d{2}:\d{2}/);
  await expect(row).toContainText("·");
});

test('T4-B: a created entry is labelled "Created" and dotted green', async ({ page }) => {
  await gotoChangeId(page, undefined, seedHistory(SECURE_ID_STR, [CREATED_ENTRY]));
  await page.getByTestId("id-history-button").click();

  const row = page.getByTestId("id-history-row").first();
  await expect(row).toHaveAttribute("data-history-action", "created");
  await expect(row).toContainText("Created");
  await expect(row).not.toContainText("Changed from");

  // T.positive — the green the rest of the app uses for a good outcome.
  const dot = row.locator("span").first();
  await expect(dot).toHaveCSS("background-color", "rgb(15, 163, 114)");
});

test('T4-C: a changed entry says what it changed from and what replaced it', async ({ page }) => {
  await gotoChangeId(page, undefined, seedHistory(SECURE_ID_STR, [CHANGED_ENTRY]));
  await page.getByTestId("id-history-button").click();

  const row = page.getByTestId("id-history-row").first();
  await expect(row).toHaveAttribute("data-history-action", "changed");
  await expect(row).toContainText("Changed from:");
  await expect(row).toContainText("Replaced by:");
  await expect(row).toContainText(OTHER_ID_STR);
  await expect(row).toContainText(SECURE_ID_STR);
});

test("T4-D: both kinds sort together, newest first", async ({ page }) => {
  await gotoChangeId(page, undefined, seedHistory(SECURE_ID_STR, [CREATED_ENTRY, CHANGED_ENTRY]));
  await page.getByTestId("id-history-button").click();

  const rows = page.getByTestId("id-history-row");
  await expect(rows).toHaveCount(2);
  // The 30 Jul rename is newer than the 28 Jul creation.
  await expect(rows.nth(0)).toHaveAttribute("data-history-action", "changed");
  await expect(rows.nth(1)).toHaveAttribute("data-history-action", "created");
});

test('T4-E: past five entries, the rest are behind "View all"', async ({ page }) => {
  const many = Array.from({ length: 7 }, (_, i) => ({
    symbolId: SYMBOLS[i % SYMBOLS.length].repeat(12),
    action: "changed",
    createdAt: new Date(Date.now() - (i + 1) * 86_400_000).toISOString(),
    replacedBy: SECURE_ID_STR,
  }));
  await gotoChangeId(page, undefined, seedHistory(SECURE_ID_STR, many));
  await page.getByTestId("id-history-button").click();

  await expect(page.getByTestId("id-history-row")).toHaveCount(5);
  const viewAll = page.getByTestId("id-history-view-all");
  await expect(viewAll).toContainText("View all (7)");

  await viewAll.click();
  await expect(page.getByTestId("id-history-row")).toHaveCount(7);
});

// ═══ TASK 5 — the receipt ══════════════════════════════════════════════════

test("T5-A: Date and Time are separate rows, and the time carries seconds", async ({ page }) => {
  await gotoDashboard(page);
  await completePayment(page);
  await expect(page.getByTestId("payment-receipt")).toBeVisible({ timeout: 30_000 });

  await expect(page.getByText("Date", { exact: true })).toBeVisible();
  await expect(page.getByText("Time", { exact: true })).toBeVisible();
  await expect(page.getByTestId("receipt-date")).toHaveText(/\d{2} \w{3} \d{4}/);
  await expect(page.getByTestId("receipt-time")).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
  // The combined row this replaced is gone.
  await expect(page.getByText("Date & Time", { exact: true })).toHaveCount(0);
});

test('T5-B: the receipt says the payment went via Gloobal Bank', async ({ page }) => {
  await gotoDashboard(page);
  await completePayment(page);
  await expect(page.getByTestId("payment-receipt")).toBeVisible({ timeout: 30_000 });

  await expect(page.getByText("Via", { exact: true })).toBeVisible();
  await expect(page.getByTestId("receipt-via")).toHaveText("Gloobal Bank");
});

test("T5-C: the outcome and the amount lead, above the detail table", async ({ page }) => {
  await gotoDashboard(page);
  await completePayment(page);
  await expect(page.getByTestId("payment-receipt")).toBeVisible({ timeout: 30_000 });

  await expect(page.getByTestId("receipt-headline")).toHaveText("Payment Successful");
  const hero = page.getByTestId("receipt-hero-amount");
  await expect(hero).toBeVisible();
  await expect(hero).toHaveCSS("font-size", "32px");

  // Above the details card, not buried in it.
  const heroBox = await hero.boundingBox();
  const rowBox = await page.getByTestId("receipt-to").boundingBox();
  expect(heroBox.y).toBeLessThan(rowBox.y);

  await expect(page.getByTestId("receipt-status")).toContainText("Completed");
});

test('T5-D: a planted seed offers "View in My Assets"', async ({ page }) => {
  await gotoDashboard(page);
  await completePayment(page);
  await expect(page.getByTestId("payment-receipt")).toBeVisible({ timeout: 30_000 });

  const note = page.getByTestId("receipt-asset-note");
  await expect(note).toBeVisible();
  await expect(note).toContainText("planted as an asset");
  await expect(page.getByTestId("receipt-view-assets")).toBeVisible();
});

test("T5-E: and the link actually reaches My Assets", async ({ page }) => {
  await gotoDashboard(page);
  await completePayment(page);
  await expect(page.getByTestId("receipt-view-assets")).toBeVisible({ timeout: 30_000 });

  await page.getByTestId("receipt-view-assets").click();

  await expect(page.getByTestId("payment-receipt")).toHaveCount(0);
  await expect(page.getByText("My Assets", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
});

// ═══ TASK 6 — Accounts tile order ══════════════════════════════════════════

test("T6-A: the account tiles are in the requested order", async ({ page }) => {
  await gotoDashboard(page);
  await page.getByRole("button", { name: "Accounts", exact: true }).click();

  const labels = await page
    .locator('[aria-label="Gloobal Bank"], [aria-label="PayLater"], [aria-label="Gloobal Coin — locked"], [aria-label="My Assets"], [aria-label="Linked Banks"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));

  expect(labels).toEqual([
    "Gloobal Bank",
    "PayLater",
    "Gloobal Coin — locked",
    "My Assets",
    "Linked Banks",
  ]);
});

test("T6-B: linked banks come after every Gloobal-native account", async ({ page }) => {
  await gotoDashboard(page);
  await page.getByRole("button", { name: "Accounts", exact: true }).click();

  const y = async (name) => (await page.getByRole("button", { name, exact: true }).boundingBox()).y;
  const linked = await y("Linked Banks");

  for (const native of ["Gloobal Bank", "PayLater", "My Assets"]) {
    expect(await y(native)).toBeLessThanOrEqual(linked);
  }
  expect(await y("Gloobal Coin — locked")).toBeLessThanOrEqual(linked);
});
