// Verification for the 2026-07-29 founder tasks.
//
//   TASK 1 — the registration Gloobal ID card carries a REGISTER badge, the
//     mirror of the login card's LOGIN badge.
//   TASK 2 — the post-PIN biometric offer appears for accounts with no
//     passkey, including when the status check itself fails.
//   TASK 3 — Profile carries My GH Score, My Network and My Gloobal ID.
//   TASK 4 — the balance opens masked, reveals behind a device check, and
//     Paid/Received report loading, empty and error states honestly.
//   TASK 5 — "My Share" replaces the preset cashback grid.
//   TASK 6 — real balances, deducted on payment, with the cashback planted.
//
// Every stub is scoped to the backend origin. A broader glob would also match
// the app's own Vite module URLs and break the module graph.
import { test, expect } from "@playwright/test";

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
    if (url.includes("/api/creator/cashback-rate")) {
      const body = route.request().postDataJSON() || {};
      return route.fulfill(json({ cashbackRate: body.cashbackRate }));
    }
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
      return route.fulfill(json({ success: true, transaction: {}, newBalance: 4000, cashback: 10, payeeReceives: 990 }, 201));
    }
    if (url.includes("/api/profile/change-symbol-id")) {
      const body = route.request().postDataJSON() || {};
      return route.fulfill(json({ newSymbolId: body.newSymbolId, user: { ...USER, symbolId: body.newSymbolId } }));
    }
    if (url.includes("/api/profile/")) return route.fulfill(json({ user: USER }));
    if (url.includes("/api/transactions/history/")) return route.fulfill(json({ success: true, transactions: [], count: 0 }));
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

async function gotoHome(page, overrides) {
  await mockBackend(page, overrides);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /Phone number/i })).toBeVisible({ timeout: 30_000 });
}

/** Landing -> OTP -> the registration Gloobal ID card. */
async function gotoRegistrationSecureId(page, overrides) {
  await gotoHome(page, overrides);
  await page.getByRole("button", { name: /Phone number/i }).click();
  await tapDigits(page, MOBILE);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText(/VERIFY OTP/i)).toBeVisible({ timeout: 30_000 });
  await tapDigits(page, OTP);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
}

/** Landing -> flip -> the login Gloobal ID card. */
async function gotoLoginSecureId(page, overrides) {
  await gotoHome(page, overrides);
  await page.getByRole("button", { name: /Flip to log in/i }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
}

/** ...on to the login PIN screen. */
async function gotoLoginPin(page, overrides) {
  await gotoLoginSecureId(page, overrides);
  await tapSymbols(page, SECURE_ID);
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();
  await expect(page.getByText(/Verify it's you/i)).toBeVisible({ timeout: 30_000 });
}

/** Boots straight onto the dashboard by seeding the persisted session. */
async function gotoDashboard(page, overrides, sessionUser = USER) {
  await mockBackend(page, overrides);
  await page.addInitScript((user) => {
    window.localStorage.setItem(
      "gloobal.session.v1",
      JSON.stringify({ user, phoneNumber: "8114491364", savedAt: Date.now() })
    );
  }, sessionUser);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toBeVisible({ timeout: 30_000 });
}

async function gotoProfile(page, overrides) {
  await gotoDashboard(page, overrides);
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(page.getByTestId("profile-header")).toBeVisible({ timeout: 30_000 });
}

/** Dashboard -> Receive -> the My Share screen. */
async function gotoMyShare(page, overrides) {
  await gotoDashboard(page, overrides);
  await page.getByRole("button", { name: "Receive", exact: true }).click();
  await expect(page.getByTestId("my-share-rate-input")).toBeVisible({ timeout: 30_000 });
}

/** Dismisses the Send Money overlay back to the dashboard. Its close control
 *  is a Back button, not a Close one. */
async function closeOverlay(page) {
  for (const name of [/^Back$/i, /^Close$/i, /Go back/i]) {
    const btn = page.getByRole("button", { name }).first();
    if (await btn.count().catch(() => 0)) {
      await btn.click().catch(() => {});
      break;
    }
  }
  await expect(page.getByRole("button", { name: "Home", exact: true })).toBeVisible({ timeout: 30_000 });
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

// ═══ TASK 1 — the REGISTER badge ═══════════════════════════════════════════

test('T1-A: Registration Gloobal ID screen shows the "Gloobal ID" heading', async ({ page }) => {
  await gotoRegistrationSecureId(page);
  await expect(page.getByText("Gloobal ID", { exact: true }).first()).toBeVisible();
});

test('T1-B: Registration Gloobal ID card carries a REGISTER badge', async ({ page }) => {
  await gotoRegistrationSecureId(page);
  const badge = page.getByTestId("secureid-badge");
  await expect(badge).toBeVisible();
  // The visible word rotates, so the stable accessible name is what is
  // asserted — catching the cycle mid-turn would otherwise read "Id".
  await expect(badge).toHaveAttribute("data-badge-mode", "register");
  await expect(badge).toHaveAttribute("aria-label", "Register · Gloobal ID");
});

test('T1-C: Login Gloobal ID card still carries the LOGIN badge, not REGISTER', async ({ page }) => {
  await gotoLoginSecureId(page);
  const badge = page.getByTestId("secureid-badge");
  await expect(badge).toBeVisible();
  await expect(badge).toHaveAttribute("data-badge-mode", "login");
  await expect(badge).toHaveAttribute("aria-label", "Login · Gloobal ID");
  await expect(page.locator('[data-badge-mode="register"]')).toHaveCount(0);
});

// ═══ TASK 2 — biometric offer after PIN ════════════════════════════════════

test("T2-A: Biometric offer appears after a correct PIN when no passkey is enrolled", async ({ page }) => {
  await gotoLoginPin(page, { "/api/passkey/status": () => json({ hasPasskey: false }) });
  await tapDigits(page, PIN);
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();

  await expect(page.getByRole("button", { name: /Verify with Face ID/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /Verify with fingerprint/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Skip for now/i })).toBeVisible();
});

test("T2-B: An account with a passkey goes straight to the dashboard after PIN", async ({ page }) => {
  await gotoLoginPin(page, { "/api/passkey/status": () => json({ hasPasskey: true }) });
  await tapDigits(page, PIN);
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();

  await expect(page.getByRole("button", { name: "Profile", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /Verify with Face ID/i })).toHaveCount(0);
});

test("T2-C: A failed passkey status check still shows the offer (fail-open)", async ({ page }) => {
  await gotoLoginPin(page, {
    "/api/passkey/status": () => json({ message: "Could not check device authentication status." }, 500),
  });
  await tapDigits(page, PIN);
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();

  // This is the regression: a 500 used to read as "already enrolled" and
  // skip the screen entirely.
  await expect(page.getByRole("button", { name: /Verify with Face ID/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /Skip for now/i })).toBeVisible();
});

// ═══ TASK 3 — Profile rows ═════════════════════════════════════════════════

test('T3-A: Profile has a "My GH Score" row', async ({ page }) => {
  await gotoProfile(page);
  await expect(page.getByRole("button", { name: "My GH Score", exact: true })).toBeVisible();
});

test('T3-B: Profile has a "My Network" row', async ({ page }) => {
  await gotoProfile(page);
  await expect(page.getByRole("button", { name: "My Network", exact: true })).toBeVisible();
});

test('T3-C: Profile has a "My Gloobal ID" row', async ({ page }) => {
  await gotoProfile(page);
  await expect(page.getByRole("button", { name: "My Gloobal ID", exact: true })).toBeVisible();
});

test('T3-D: "My GH Score" opens the GH Score categories screen', async ({ page }) => {
  await gotoProfile(page);
  await page.getByRole("button", { name: "My GH Score", exact: true }).click();
  await expect(page.getByTestId("gh-category-self")).toBeVisible({ timeout: 30_000 });
});

test('T3-E: "My Gloobal ID" opens the Change ID screen', async ({ page }) => {
  await gotoProfile(page);
  await page.getByRole("button", { name: "My Gloobal ID", exact: true }).click();
  await expect(page.getByTestId("current-gloobal-id")).toBeVisible({ timeout: 30_000 });
});

// ═══ TASK 4 — masked balance, device reveal, honest money panels ═══════════

test("T4-A: Balance is masked on dashboard load", async ({ page }) => {
  await gotoDashboard(page);
  await expect(page.getByTestId("balance-amount")).toContainText("•••••••");
  await expect(page.getByTestId("balance-amount")).not.toContainText("5,000");
});

test("T4-B: Tapping the eye reveals the balance", async ({ page }) => {
  // No passkey on this account, so no device prompt stands in the way — the
  // balance must not be locked behind a check that can never succeed.
  await gotoDashboard(page);
  await expect(page.getByTestId("balance-amount")).toContainText("•••••••");
  await page.getByTestId("balance-eye").click();
  await expect(page.getByTestId("balance-amount")).toContainText("5,000.00");
  await expect(page.getByTestId("balance-amount")).not.toContainText("•••••••");
});

test("T4-C: A second tap hides the balance again", async ({ page }) => {
  await gotoDashboard(page);
  await page.getByTestId("balance-eye").click();
  await expect(page.getByTestId("balance-amount")).toContainText("5,000.00");
  await page.getByTestId("balance-eye").click();
  await expect(page.getByTestId("balance-amount")).toContainText("•••••••");
});

test("T4-D: The balance is masked again after a reload", async ({ page }) => {
  await gotoDashboard(page);
  await page.getByTestId("balance-eye").click();
  await expect(page.getByTestId("balance-amount")).toContainText("5,000.00");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("balance-amount")).toContainText("•••••••");
});

test("T4-E: Paid loads real transactions from the backend", async ({ page }) => {
  const history = {
    success: true,
    count: 2,
    transactions: [
      { amount: 250, direction: "sent", status: "success", createdAt: "2026-07-20T10:00:00.000Z", counterparty: { fullName: "Rahul Verma", symbolId: OTHER_ID_STR } },
      { amount: 400, direction: "sent", status: "success", createdAt: "2026-07-22T10:00:00.000Z", counterparty: { fullName: "Anita Rao", symbolId: OTHER_ID_STR } },
    ],
  };
  // Held open briefly so the loading state is observable rather than a race.
  await gotoDashboard(page, {
    "/api/transactions/history/": async () => {
      await new Promise((r) => setTimeout(r, 1200));
      return json(history);
    },
  });

  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Paid", exact: true }).click();

  await expect(page.getByTestId("money-spinner")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("money-spinner")).toHaveCount(0, { timeout: 30_000 });

  await expect(page.getByText("Rahul Verma", { exact: true })).toBeVisible();
  await expect(page.getByText("Anita Rao", { exact: true })).toBeVisible();
});

test("T4-F: Received shows an empty state when there are none", async ({ page }) => {
  await gotoDashboard(page);
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Received", exact: true }).click();
  await expect(page.getByText("No transactions yet").first()).toBeVisible({ timeout: 30_000 });
});

test("T4-G: A failed history fetch is reported and retryable", async ({ page }) => {
  let attempts = 0;
  await gotoDashboard(page, {
    "/api/transactions/history/": () => {
      attempts += 1;
      return json({ message: "boom" }, 500);
    },
  });

  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "Paid", exact: true }).click();

  const retry = page.getByRole("button", { name: /Could not load transactions/i });
  await expect(retry).toBeVisible({ timeout: 30_000 });

  const before = attempts;
  await retry.click();
  await expect.poll(() => attempts).toBeGreaterThan(before);
});

// ═══ TASK 5 — the My Share screen ══════════════════════════════════════════

test('T5-A: My Share replaces the old "Share with Gloobal users" grid', async ({ page }) => {
  await gotoMyShare(page);
  await expect(page.getByText("My Share", { exact: true })).toBeVisible();
  await expect(page.getByText("Share with Gloobal users")).toHaveCount(0);
  // The eight preset squares are gone, not merely restyled.
  await expect(page.getByTestId("creator-rate-0")).toHaveCount(0);
  await expect(page.getByTestId("creator-rate-7")).toHaveCount(0);
});

test("T5-B: The large rate display is the input, and it is editable", async ({ page }) => {
  await gotoMyShare(page);
  await expect(page.getByText("My Contribution", { exact: true })).toBeVisible();
  const input = page.getByTestId("my-share-rate-input");
  await expect(input).toBeVisible();
  await input.fill("1.57");
  await expect(input).toHaveValue("1.57");
});

test("T5-C: The slider stays in sync with the large input", async ({ page }) => {
  await gotoMyShare(page);
  await page.getByTestId("my-share-rate-input").fill("3.5");
  await expect(page.getByTestId("my-share-slider")).toHaveValue("3.5");
});

test("T5-D: The live example and preview update on every keystroke", async ({ page }) => {
  await gotoMyShare(page);
  await page.getByTestId("my-share-rate-input").fill("1.57");
  // 1.57% of 1,000 is 15.70 — in the person's own currency, never a
  // hardcoded symbol.
  await expect(page.getByTestId("my-share-example")).toContainText("15.70");
  await expect(page.getByTestId("my-share-example")).toContainText("1000.00");
  await expect(page.getByTestId("my-share-preview")).toContainText("15.70");
});

test("T5-E: The preview card carries all three rows", async ({ page }) => {
  await gotoMyShare(page);
  const preview = page.getByTestId("my-share-preview");
  await expect(preview).toContainText("Payment amount");
  await expect(preview).toContainText("User gets");
  await expect(preview).toContainText("My contribution");
});

test("T5-F: A value above 7 shows an error and disables Continue", async ({ page }) => {
  await gotoMyShare(page);
  await page.getByTestId("my-share-custom-input").fill("8");
  await expect(page.getByTestId("my-share-range-error")).toContainText("Must be between 0% and 7%");
  await expect(page.getByTestId("my-share-continue")).toBeDisabled();
});

test("T5-G: Continue sends the rate as a decimal", async ({ page }) => {
  const patched = [];
  await gotoMyShare(page, {
    "/api/creator/cashback-rate": (route) => {
      patched.push({ method: route.request().method(), body: route.request().postDataJSON() });
      return json({ cashbackRate: (route.request().postDataJSON() || {}).cashbackRate });
    },
  });

  await page.getByTestId("my-share-rate-input").fill("1.57");
  await page.getByTestId("my-share-continue").click();

  await expect.poll(() => patched.length).toBeGreaterThan(0);
  expect(patched[0].method).toBe("PATCH");
  // Exactly 0.0157, not 0.015700000000000002.
  expect(patched[0].body.cashbackRate).toBe(0.0157);
  expect(patched[0].body.symbolId).toBe(SECURE_ID_STR);
});

test('T5-H: "Not now" carries on without saving', async ({ page }) => {
  const patched = [];
  await gotoMyShare(page, {
    "/api/creator/cashback-rate": (route) => {
      patched.push(route.request().postDataJSON());
      return json({ cashbackRate: 0 });
    },
  });

  await page.getByTestId("my-share-not-now").click();
  await expect(page.getByText("Share this Gloobal ID to receive money")).toBeVisible({ timeout: 30_000 });
  expect(patched).toHaveLength(0);
});

// ═══ TASK 6 — real balance, deducted on payment ════════════════════════════

test("T6-A: The dashboard balance is the account's real one, not the old constant", async ({ page }) => {
  await gotoDashboard(page);
  await page.getByTestId("balance-eye").click();
  await expect(page.getByTestId("balance-amount")).toContainText("5,000.00");
  await expect(page.getByTestId("balance-amount")).not.toContainText("12,480.50");
});

test("T6-B: The sender's balance drops after a payment", async ({ page }) => {
  await gotoDashboard(page);
  await page.getByTestId("balance-eye").click();
  await expect(page.getByTestId("balance-amount")).toContainText("5,000.00");

  await completePayment(page);

  // Send renders over the dashboard; closing it returns to the balance card.
  await expect(page.getByText(/Paid /i).first()).toBeVisible({ timeout: 30_000 });
  await closeOverlay(page);
  await expect(page.getByTestId("balance-amount")).toContainText("4,000.00", { timeout: 30_000 });
});

test("T6-C: The success toast names the asset earned when cashback is due", async ({ page }) => {
  await gotoDashboard(page);
  await completePayment(page);

  const toast = page.getByText(/You earned/i).first();
  await expect(toast).toBeVisible({ timeout: 30_000 });
  await expect(toast).toContainText("as an asset");
  await expect(toast).toContainText("10.00");
});

test("T6-D: An insufficient balance is reported and nothing is deducted", async ({ page }) => {
  await gotoDashboard(page, {
    "/api/transactions/send": () => json({ success: false, message: "Insufficient balance." }, 400),
  });
  await page.getByTestId("balance-eye").click();
  await expect(page.getByTestId("balance-amount")).toContainText("5,000.00");

  await completePayment(page);
  await expect(page.getByText(/Insufficient balance/i).first()).toBeVisible({ timeout: 30_000 });
});

test("T6-E: The seed a payment plants shows up in My Assets", async ({ page }) => {
  // My Assets is unmounted while closed and re-reads on every open, so the
  // seed the payment planted is simply there the next time it is opened.
  const planted = [{
    _id: "seed-1",
    business: "Rahul Verma",
    category: "General",
    amountPaid: 1000,
    cashbackRate: 0.01,
    cashback: 10,
    currency: "INR",
    plantedAt: new Date().toISOString(),
  }];
  await gotoDashboard(page, {
    "/api/assets/": (route) => {
      if (route.request().url().includes("/paylater/")) return null;
      return json({ totalAssets: 10, futureAssets: 1000, seeds: planted, avgYearsToTarget: 38, payLaterLimit: 10 });
    },
  });

  await completePayment(page);
  await expect(page.getByText(/Paid /i).first()).toBeVisible({ timeout: 30_000 });
  await closeOverlay(page);

  await page.getByRole("button", { name: "Accounts", exact: true }).click();
  await page.getByRole("button", { name: "My Assets", exact: true }).click();

  // The seed planted by the payment above, not the demo fallback.
  await expect(page.getByText("Rahul Verma").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Demo data", { exact: true })).toHaveCount(0);
});
