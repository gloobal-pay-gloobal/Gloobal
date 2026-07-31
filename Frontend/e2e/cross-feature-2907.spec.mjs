// Cross-feature verification for the 2026-07-29 work.
//
// The per-task suite (fix-verification-2907) proves each item works on its
// own. This one drives two or more of them in the same session and asserts
// that neither breaks, hides, strands or contradicts the other — the class of
// bug that only appears once features share state.
//
// Pairs under test:
//   X1  every new surface opened and closed in one run, nothing stranded
//   X2  a payment updates the balance without unmasking it          (T4 x T6)
//   X3  a signed-out account's receipt never lands on the next one  (T6 x session)
//   X4  the rate saved in My Share is the rate the payment uses     (T5 x T6)
//   X5  reveal survives tab navigation but never a reload           (T4 x nav)
//   X6  a failed history fetch recovers on retry                    (T4 x retry)
//   X7  a renamed Gloobal ID re-reads balance and rate under it     (T3 x T5/T6)
//   X8  skipping the biometric offer leaves the balance revealable  (T2 x T4)
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

const RENAMED_ID = Array.from({ length: 12 }, (_, i) => SYMBOLS[(i + 5) % SYMBOLS.length]);
const RENAMED_ID_STR = RENAMED_ID.join("");

const MOBILE = "8114491364";
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

// The account signed into *after* a logout. A different balance on purpose:
// that is the number the previous account's receipt must not overwrite.
const SECOND_USER = { ...USER, fullName: "Arjun Nair", balance: 750 };

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
    if (url.includes("/api/symbol/availability") || url.includes("/api/symbol-availability")) {
      return route.fulfill(json({ available: true }));
    }
    if (url.includes("/api/users/resolve")) {
      const identifier = decodeURIComponent(new URL(url).searchParams.get("identifier") || "");
      if (identifier === OTHER_ID_STR) return route.fulfill(json({ success: true, user: RECIPIENT }));
      // The rename target has to read as free, or the Update ID button never
      // becomes available — resolve doubles as the availability check.
      if (identifier === RENAMED_ID_STR) return route.fulfill(json({ user: null }, 404));
      return route.fulfill(json({ success: true, user: USER }));
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
    // The dashboard reads GET /api/transactions/:symbolId now (records plus
    // lifetime totals); Send Money still reads /history for its own sheet.
    if (url.includes("/api/transactions/")) return route.fulfill(json({ success: true, transactions: [], count: 0, totalSent: 0, totalReceived: 0 }));
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

async function boot(page, overrides, sessionUser = USER) {
  await mockBackend(page, overrides);
  await page.addInitScript((user) => {
    window.localStorage.setItem(
      "gloobal.session.v1",
      JSON.stringify({ user, phoneNumber: "8114491364", savedAt: Date.now() })
    );
  }, sessionUser);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  // A restored session now opens the lock screen, not the dashboard.
  await unlockRestoredSession(page);
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toBeVisible({ timeout: 30_000 });
}

const goHome = async (page) => page.getByRole("button", { name: "Home", exact: true }).click();
const goProfile = async (page) => {
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(page.getByTestId("profile-header")).toBeVisible({ timeout: 30_000 });
};
const goAccounts = async (page) => page.getByRole("button", { name: "Accounts", exact: true }).click();

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
  // The payment lands on its receipt rather than on a toast.
  await expect(page.getByTestId("payment-receipt")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("receipt-done").click();
}

// ═══ X1 — every new surface, one session ═══════════════════════════════════

test("X1: today's surfaces all open and close in one session without stranding", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await boot(page);

  // Receive -> My Share -> receive sheet -> closed.
  await page.getByRole("button", { name: "Receive", exact: true }).click();
  await expect(page.getByTestId("my-share-rate-input")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("my-share-rate-input").fill("1.57");
  await page.getByTestId("my-share-continue").click();
  await expect(page.getByText("Share this Gloobal ID to receive money")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Close", exact: true }).first().click();
  await expect(page.getByTestId("my-share-rate-input")).toHaveCount(0);

  // The balance card survived the overlay stack, and is still masked.
  await expect(page.getByTestId("balance-amount")).toContainText("•••••••");

  // Profile -> each of the three renamed rows -> back.
  await goProfile(page);
  await page.getByRole("button", { name: "My GH Score", exact: true }).click();
  await expect(page.getByTestId("gh-category-self")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByTestId("profile-header")).toBeVisible();

  await page.getByRole("button", { name: "My Network", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).first().click();
  await expect(page.getByTestId("profile-header")).toBeVisible();

  await page.getByRole("button", { name: "My Gloobal ID", exact: true }).click();
  await expect(page.getByTestId("current-gloobal-id")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByTestId("profile-header")).toBeVisible();

  // Home -> the eye still works after all of that.
  await goHome(page);
  await page.getByTestId("balance-eye").click();
  await expect(page.getByTestId("balance-amount")).toContainText("5,000.00");

  expect(pageErrors).toEqual([]);
});

// ═══ X2 — a payment must not unmask the balance ════════════════════════════

test("X2: a payment updates the balance without revealing it", async ({ page }) => {
  await boot(page);
  await expect(page.getByTestId("balance-amount")).toContainText("•••••••");

  await completePayment(page);
  await closeOverlay(page);

  // The number changed underneath, but the mask is the user's choice and a
  // payment is not consent to drop it.
  await expect(page.getByTestId("balance-amount")).toContainText("•••••••");
  await page.getByTestId("balance-eye").click();
  await expect(page.getByTestId("balance-amount")).toContainText("4,000.00");
});

// ═══ X3 — a receipt must not outlive its account ═══════════════════════════

test("X3: a signed-out account's payment never moves the next account's balance", async ({ page }) => {
  await boot(page);
  await completePayment(page);
  await closeOverlay(page);
  await page.getByTestId("balance-eye").click();
  await expect(page.getByTestId("balance-amount")).toContainText("4,000.00");

  // Sign out, then sign back in as a different account holding 750.
  await goProfile(page);
  await page.getByRole("button", { name: "Exit", exact: true }).click();
  await expect(page.getByRole("button", { name: /Phone number/i })).toBeVisible({ timeout: 30_000 });

  await page.route(`${BACKEND}/api/profile/**`, (route) => route.fulfill(json({ user: SECOND_USER })));
  await page.route(`${BACKEND}/api/login`, (route) => route.fulfill(json({ user: SECOND_USER })));

  await page.getByRole("button", { name: /Flip to log in/i }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
  await tapSymbols(page, SECURE_ID);
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();
  await expect(page.getByText(/Verify it's you/i)).toBeVisible({ timeout: 30_000 });
  await tapDigits(page, PIN);
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();
  await page.getByRole("button", { name: /Skip for now/i }).click();
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toBeVisible({ timeout: 30_000 });

  // The previous account's receipt is still in memory. It must not be
  // applied to this one.
  await page.getByTestId("balance-eye").click();
  await expect(page.getByTestId("balance-amount")).toContainText("750.00");
  await expect(page.getByTestId("balance-amount")).not.toContainText("4,000.00");
});

// ═══ X4 — the saved rate is the rate the payment uses ══════════════════════

test("X4: the rate saved in My Share is what the payment's seed is planted at", async ({ page }) => {
  let savedRate = null;
  await boot(page, {
    "/api/creator/cashback-rate": (route) => {
      savedRate = (route.request().postDataJSON() || {}).cashbackRate;
      return json({ cashbackRate: savedRate });
    },
  });

  await page.getByRole("button", { name: "Receive", exact: true }).click();
  await page.getByTestId("my-share-rate-input").fill("6.25");
  await page.getByTestId("my-share-continue").click();
  await expect(page.getByText("Share this Gloobal ID to receive money")).toBeVisible({ timeout: 30_000 });
  expect(savedRate).toBe(0.0625);

  // Reopening shows the rate that was saved, not a rounded stand-in.
  await page.getByRole("button", { name: "Close", exact: true }).first().click();
  await page.getByRole("button", { name: "Receive", exact: true }).click();
  await expect(page.getByTestId("my-share-rate-input")).toHaveValue("6.25");
});

// ═══ X5 — reveal survives navigation, never a reload ═══════════════════════

test("X5: a revealed balance survives tab navigation but not a reload", async ({ page }) => {
  await boot(page);
  await page.getByTestId("balance-eye").click();
  await expect(page.getByTestId("balance-amount")).toContainText("5,000.00");

  await goAccounts(page);
  await goProfile(page);
  await goHome(page);
  // Still revealed — navigating around the app is not a reason to re-ask.
  await expect(page.getByTestId("balance-amount")).toContainText("5,000.00");

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("balance-amount")).toContainText("•••••••");
});

// ═══ X6 — the money panels recover from a failure ══════════════════════════

test("X6: a failed history fetch recovers on retry rather than reading as empty", async ({ page }) => {
  // Stays failing until the test says otherwise. Failing only once would be
  // consumed by the fetch on dashboard mount, long before Paid is opened.
  let failing = true;
  const rows = {
    success: true,
    count: 1,
    transactions: [
      { amount: 250, direction: "sent", status: "success", createdAt: "2026-07-20T10:00:00.000Z", counterparty: { fullName: "Rahul Verma", symbolId: OTHER_ID_STR } },
    ],
  };
  await boot(page, {
    "/api/transactions/": (route) =>
      route.request().url().includes("/send") ? null : (failing ? json({ message: "boom" }, 500) : json(rows)),
  });

  await goProfile(page);
  await page.getByRole("button", { name: "Paid", exact: true }).click();

  // The failure is reported, and crucially is not "No transactions yet".
  const retry = page.getByRole("button", { name: /Could not load transactions/i });
  await expect(retry).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("No transactions yet")).toHaveCount(0);

  failing = false;
  await retry.click();
  await expect(page.getByText("Rahul Verma", { exact: true })).toBeVisible({ timeout: 30_000 });
});

// ═══ X7 — a rename must not strand the money screens ═══════════════════════

test("X7: renaming the Gloobal ID re-reads the balance and rate under the new ID", async ({ page }) => {
  const profileReads = [];
  await boot(page, {
    "/api/profile/": (route) => {
      const url = route.request().url();
      if (url.includes("change-symbol-id")) return null;
      profileReads.push(decodeURIComponent(url.split("/api/profile/")[1] || ""));
      return json({ user: { ...USER, symbolId: profileReads[profileReads.length - 1], balance: 5000 } });
    },
  });

  await goProfile(page);
  await page.getByRole("button", { name: "My Gloobal ID", exact: true }).click();
  await expect(page.getByTestId("current-gloobal-id")).toBeVisible({ timeout: 30_000 });

  await tapSymbols(page, RENAMED_ID);
  await expect(page.getByTestId("new-id-available")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Update ID", exact: true }).click();
  await expect(page.getByTestId("id-biometric-overlay")).toBeVisible();
  await tapDigits(page, PIN);
  await page.getByTestId("id-pin-confirm").click();
  await expect(page.getByTestId("id-biometric-overlay")).toHaveCount(0, { timeout: 30_000 });

  // The app must never be left reading the old ID once the rename has gone
  // through — the balance and the cashback rate both hang off that read.
  await expect
    .poll(() => profileReads.some((id) => id === RENAMED_ID_STR), { timeout: 30_000 })
    .toBeTruthy();

  await goHome(page);
  await page.getByTestId("balance-eye").click();
  await expect(page.getByTestId("balance-amount")).toContainText("5,000.00");
});

// ═══ X10 — a slow profile read must not cost a Creator their rate ═════════

test("X10: a saved rate arriving late still lands in My Share, and is not overwritten", async ({ page }) => {
  // The saved rate rides in on the profile read. Open Receive before that
  // lands and the screen would show 0 — and Continue would write that 0 over
  // a real rate the Creator had chosen.
  const patched = [];
  await mockBackend(page, {
    "/api/profile/": async (route) => {
      if (route.request().url().includes("change-symbol-id")) return null;
      await new Promise((r) => setTimeout(r, 1500));
      return json({ user: { ...USER, cashbackRate: 0.0625 } });
    },
    "/api/creator/cashback-rate": (route) => {
      patched.push((route.request().postDataJSON() || {}).cashbackRate);
      return json({ cashbackRate: 0.0625 });
    },
  });
  await page.addInitScript((user) => {
    window.localStorage.setItem(
      "gloobal.session.v1",
      JSON.stringify({ user, phoneNumber: "8114491364", savedAt: Date.now() })
    );
  }, USER);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  // A restored session now opens the lock screen, not the dashboard.
  await unlockRestoredSession(page);
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toBeVisible({ timeout: 30_000 });

  // Straight into Receive, ahead of the profile read.
  await page.getByRole("button", { name: "Receive", exact: true }).click();
  await expect(page.getByTestId("my-share-rate-input")).toBeVisible({ timeout: 30_000 });

  // Once the read lands, the screen shows what was actually saved.
  await expect(page.getByTestId("my-share-rate-input")).toHaveValue("6.25", { timeout: 30_000 });

  await page.getByTestId("my-share-continue").click();
  await expect.poll(() => patched.length).toBeGreaterThan(0);
  // Their own rate, not a 0 the screen invented while waiting.
  expect(patched[0]).toBe(0.0625);
});

// ═══ X9 — the same, with no profile read to paper over it ═════════════════

test("X9: a stale receipt is not shown as a balance when the profile read fails", async ({ page }) => {
  // X3 passes partly because the incoming profile read overwrites whatever
  // the receipt left behind. Take that read away — a cold Render dyno, an
  // offline moment — and any leftover receipt is the only thing left to
  // render. It must not be treated as this account's balance.
  await boot(page);
  await completePayment(page);
  await closeOverlay(page);
  await page.getByTestId("balance-eye").click();
  await expect(page.getByTestId("balance-amount")).toContainText("4,000.00");

  await goProfile(page);
  await page.getByRole("button", { name: "Exit", exact: true }).click();
  await expect(page.getByRole("button", { name: /Phone number/i })).toBeVisible({ timeout: 30_000 });

  await page.route(`${BACKEND}/api/profile/**`, (route) => route.fulfill(json({ message: "cold start" }, 503)));

  await page.getByRole("button", { name: /Flip to log in/i }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
  await tapSymbols(page, SECURE_ID);
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();
  await expect(page.getByText(/Verify it's you/i)).toBeVisible({ timeout: 30_000 });
  await tapDigits(page, PIN);
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();
  await page.getByRole("button", { name: /Skip for now/i }).click();
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toBeVisible({ timeout: 30_000 });

  await page.getByTestId("balance-eye").click();
  // A dash is the honest answer here. The previous account's 4,000 is not.
  await expect(page.getByTestId("balance-amount")).not.toContainText("4,000.00");
});

// ═══ X8 — skipping the biometric offer leaves the balance reachable ════════

test("X8: skipping the biometric offer still leaves the balance revealable", async ({ page }) => {
  await mockBackend(page, { "/api/passkey/status": () => json({ hasPasskey: false }) });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: /Flip to log in/i }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
  await tapSymbols(page, SECURE_ID);
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();
  await tapDigits(page, PIN);
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();

  // The offer shows (that is the T2 fix), and skipping it must not leave the
  // account locked out of its own balance behind a check it never set up.
  await page.getByRole("button", { name: /Skip for now/i }).click();
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toBeVisible({ timeout: 30_000 });

  await expect(page.getByTestId("balance-amount")).toContainText("•••••••");
  await page.getByTestId("balance-eye").click();
  await expect(page.getByTestId("balance-amount")).toContainText("5,000.00");
});
