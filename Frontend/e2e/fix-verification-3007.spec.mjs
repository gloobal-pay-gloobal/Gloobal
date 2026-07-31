// Verification for the 2026-07-30 founder tasks.
//
//   TASK 1 — one currency symbol everywhere on the dashboard.
//   TASK 2 — a successful payment lands on a receipt screen.
//   TASK 3 — PAID / RECEIVED and the week's bars come from the backend.
//   TASK 4 — PayLater history is the account's own records.
//   TASK 5 — My Assets carries no demo data.
//   TASK 6 — ID history opens from the top-right, capped at five.
//   TASK 7 — Profile has no Currency or Subscriptions row.
//   TASK 8 — the new GH Score component. BLOCKED: GHScore_jsx__1_.txt was
//     never on disk, so those five checks are skipped rather than faked.
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
      return route.fulfill(json({
        success: true,
        transaction: { id: "txn-a1b2c3d4e5f6", referenceId: "GLOOBAL-TXN-0001", createdAt: new Date().toISOString() },
        newBalance: 4000,
        cashback: 10,
        cashbackRate: 0.01,
        payeeReceives: 990,
      }, 201));
    }
    if (url.includes("/api/profile/change-symbol-id")) {
      const body = route.request().postDataJSON() || {};
      return route.fulfill(json({ newSymbolId: body.newSymbolId, user: { ...USER, symbolId: body.newSymbolId } }));
    }
    if (url.includes("/api/profile/")) return route.fulfill(json({ user: USER }));
    if (url.includes("/api/transactions/history/")) return route.fulfill(json({ success: true, transactions: [], count: 0 }));
    // The dashboard's own read: records plus the account's lifetime totals.
    if (url.includes("/api/transactions/")) return route.fulfill(json(EMPTY_SUMMARY));
    if (url.includes("/api/passkey/")) return route.fulfill(json({ hasPasskey: false }));
    return route.fulfill(json({}));
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
}

const tapSymbols = async (page, symbols) => {
  for (const s of symbols) await page.getByRole("button", { name: `Symbol ${s}`, exact: true }).click();
};
const tapPinSheet = async (page, pin) => {
  for (const d of pin) await page.locator("button.pin-key", { hasText: new RegExp(`^${d}$`) }).first().click();
};

/** Boots straight onto the dashboard by seeding the persisted session. */
async function gotoDashboard(page, overrides, initScript, sessionUser = USER, phone = MOBILE) {
  await mockBackend(page, overrides);
  await page.addInitScript(
    ({ user, phoneNumber }) => {
      window.localStorage.setItem(
        "gloobal.session.v1",
        JSON.stringify({ user, phoneNumber, savedAt: Date.now() })
      );
    },
    { user: sessionUser, phoneNumber: phone }
  );
  // Either a bare function, or { fn, arg } when the script needs a value
  // from the test (localStorage seeds, mostly).
  if (typeof initScript === "function") await page.addInitScript(initScript);
  else if (initScript) await page.addInitScript(initScript.fn, initScript.arg);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  // A restored session now opens the lock screen, not the dashboard.
  await unlockRestoredSession(page);
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

async function gotoMyAssets(page, overrides) {
  await gotoDashboard(page, overrides);
  await page.getByRole("button", { name: "Accounts", exact: true }).click();
  await page.getByRole("button", { name: "My Assets", exact: true }).click();
}

async function gotoPayLater(page, overrides) {
  await gotoDashboard(page, overrides);
  await page.getByRole("button", { name: "Accounts", exact: true }).click();
  await page.getByRole("button", { name: /PayLater/i }).first().click();
  await expect(page.getByText("Available PayLater balance")).toBeVisible({ timeout: 30_000 });
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

// ═══ TASK 1 — one currency symbol ══════════════════════════════════════════

test("T1-A: Balance card and PAID/RECEIVED use the same currency symbol", async ({ page }) => {
  await gotoDashboard(page, {
    "/api/transactions/": (route) =>
      route.request().url().includes("/send") ? null
        : json({ ...EMPTY_SUMMARY, totalSent: 446.78, totalReceived: 291.66 }),
  });

  await page.getByTestId("balance-eye").click();
  await expect(page.getByTestId("balance-amount")).toContainText("5,000.00");

  const balance = await page.getByTestId("balance-amount").innerText();
  const paid = await page.getByTestId("card-paid").innerText();
  const received = await page.getByTestId("card-received").innerText();

  // The account registered on an Indian number, so all three carry ₹ — and
  // none of them carries a different one.
  for (const text of [balance, paid, received]) {
    expect(text.trim().startsWith("₹")).toBe(true);
    expect(text).not.toMatch(/[¥$£€]/);
  }
});

test("T1-B: Currency symbol follows the account's country, not a hardcoded one", async ({ page }) => {
  await gotoDashboard(page);
  await page.getByTestId("balance-eye").click();
  await expect(page.getByTestId("balance-amount")).toContainText("₹");

  // A US account on the same build gets $, which is what makes ₹ above a
  // lookup rather than a default that happens to look right.
  const usUser = { ...USER, mobileNumber: "+14155550123" };
  await gotoDashboard(page, undefined, undefined, usUser, "4155550123");
  await page.getByTestId("balance-eye").click();
  await expect(page.getByTestId("balance-amount")).toContainText("$");
  await expect(page.getByTestId("balance-amount")).not.toContainText("₹");
});

// ═══ TASK 2 — the receipt screen ═══════════════════════════════════════════

test("T2-A: Receipt screen appears after a successful payment", async ({ page }) => {
  await gotoDashboard(page);
  await completePayment(page);

  await expect(page.getByTestId("payment-receipt")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Payment Receipt", { exact: true })).toBeVisible();
  await expect(page.getByTestId("receipt-tick")).toBeVisible();
});

test("T2-B: Receipt card shows the payment's own details", async ({ page }) => {
  await gotoDashboard(page);
  await completePayment(page);

  await expect(page.getByTestId("payment-receipt")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("receipt-to")).toContainText(OTHER_ID_STR);
  await expect(page.getByTestId("receipt-amount")).toContainText("₹");
  await expect(page.getByTestId("receipt-status")).toContainText("Completed");
  // Last 8 of the transaction id from the send response, # prefixed.
  await expect(page.getByTestId("receipt-txn-id")).toHaveText("#C3D4E5F6");
});

test("T2-C: The asset note appears only when cashback was actually earned", async ({ page }) => {
  await gotoDashboard(page);
  await completePayment(page);
  await expect(page.getByTestId("receipt-asset-note")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("receipt-asset-note")).toContainText("planted as an asset");

  // A plain person-to-person send earns nothing, so it claims nothing.
  await gotoDashboard(page, {
    "/api/transactions/send": () =>
      json({
        success: true,
        transaction: { id: "txn-zzzz9999", createdAt: new Date().toISOString() },
        newBalance: 4000,
        cashback: 0,
        cashbackRate: 0,
      }, 201),
  });
  await completePayment(page);
  await expect(page.getByTestId("payment-receipt")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("receipt-asset-note")).toHaveCount(0);
  await expect(page.getByTestId("receipt-cashback")).toHaveCount(0);
});

test('T2-D: "Done" returns to the dashboard, not to the send form', async ({ page }) => {
  await gotoDashboard(page);
  await completePayment(page);
  await expect(page.getByTestId("payment-receipt")).toBeVisible({ timeout: 30_000 });

  await page.getByTestId("receipt-done").click();
  await expect(page.getByTestId("payment-receipt")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Home", exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("button.send-btn")).toHaveCount(0);
});

// ═══ TASK 3 — real PAID / RECEIVED ═════════════════════════════════════════

test("T3-A: PAID and RECEIVED report the backend's totals", async ({ page }) => {
  await gotoDashboard(page, {
    "/api/transactions/": (route) =>
      route.request().url().includes("/send") ? null
        : json({ ...EMPTY_SUMMARY, totalSent: 500, totalReceived: 200 }),
  });

  await expect(page.getByTestId("card-paid")).toHaveText("₹500.00", { timeout: 30_000 });
  await expect(page.getByTestId("card-received")).toHaveText("₹200.00");
  // The figure the card used to invent.
  await expect(page.getByTestId("card-paid")).not.toContainText("446.78");
});

test("T3-B: The week's bars are flat when there are no transactions", async ({ page }) => {
  await gotoDashboard(page);
  await expect(page.getByTestId("card-paid")).toHaveText("₹0.00", { timeout: 30_000 });

  // Every bar sits at the 4px floor — nothing is taller than anything else,
  // which is what an empty week actually looks like.
  const heights = await page.locator('[data-day-index] div[role="img"]').evaluateAll((els) =>
    els.map((el) => Math.round(el.getBoundingClientRect().height))
  );
  expect(heights.length).toBe(14); // 7 days x paid + received
  expect(Math.max(...heights)).toBeLessThanOrEqual(5);
});

test("T3-C: PAID/RECEIVED shimmer while the fetch is in flight", async ({ page }) => {
  await gotoDashboard(page, {
    "/api/transactions/": async (route) => {
      if (route.request().url().includes("/send")) return null;
      await new Promise((r) => setTimeout(r, 900));
      return json({ ...EMPTY_SUMMARY, totalSent: 500, totalReceived: 200 });
    },
  });

  // Placeholders, never a stand-in number, until the real figures land.
  await expect(page.getByTestId("card-paid-skeleton")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("card-paid")).toHaveCount(0);
  await expect(page.getByTestId("card-paid")).toHaveText("₹500.00", { timeout: 30_000 });
});

// ═══ TASK 4 — PayLater history ═════════════════════════════════════════════

test("T4-A: PayLater lists the account's own records", async ({ page }) => {
  await gotoPayLater(page, {
    "/api/assets/paylater/": () =>
      json({
        limit: 100,
        available: 50,
        pendingDues: 50,
        transactions: [
          { id: "t1", type: "charge", amount: 50, description: "PayLater charge · Rahul Verma", createdAt: new Date().toISOString() },
          { id: "t2", type: "credit", amount: 10, description: "Cashback credited · Rahul Verma", createdAt: new Date().toISOString() },
        ],
      }),
  });

  await expect(page.getByTestId("paylater-row")).toHaveCount(2);
  await expect(page.getByText("PayLater charge · Rahul Verma")).toBeVisible();
  await expect(page.getByText("Cashback credited · Rahul Verma")).toBeVisible();
  // None of the ledger that used to be hardcoded here.
  for (const invented of ["Metro Recharge", "Grocery Mart", "Coffee Corner", "City Electricity"]) {
    await expect(page.getByText(invented, { exact: true })).toHaveCount(0);
  }
});

test("T4-B: PayLater says so when there is no activity", async ({ page }) => {
  await gotoPayLater(page);
  await expect(page.getByTestId("paylater-empty")).toHaveText("No PayLater activity yet.");
  await expect(page.getByTestId("paylater-row")).toHaveCount(0);
});

// ═══ TASK 5 — My Assets carries no demo data ═══════════════════════════════

test('T5-A: The "Demo data" chip is gone', async ({ page }) => {
  await gotoMyAssets(page);
  await expect(page.getByTestId("assets-empty")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Demo data", { exact: true })).toHaveCount(0);
});

test("T5-B: An account with no seeds gets a real empty state", async ({ page }) => {
  await gotoMyAssets(page);
  await expect(page.getByTestId("assets-empty")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("No assets yet", { exact: true })).toBeVisible();
  await expect(page.getByText(/Pay a business to earn cashback/i)).toBeVisible();
  await expect(page.getByText(/PayLater limit will grow here too/i)).toBeVisible();
});

test("T5-C: The invented businesses are nowhere on the screen", async ({ page }) => {
  await gotoMyAssets(page);
  await expect(page.getByTestId("assets-empty")).toBeVisible({ timeout: 30_000 });
  for (const business of ["Airtel", "Swiggy", "BESCOM", "BookMyShow", "Jio"]) {
    await expect(page.getByText(business, { exact: true })).toHaveCount(0);
  }
  await expect(page.getByTestId("asset-seed-row")).toHaveCount(0);
});

test("T5-D: Real seeds still render when the account has them", async ({ page }) => {
  await gotoMyAssets(page, {
    "/api/assets/": (route) => {
      if (route.request().url().includes("/paylater/")) return null;
      return json({
        totalAssets: 10,
        futureAssets: 1000,
        seeds: [{
          _id: "seed-1", business: "Rahul Verma", category: "General",
          amountPaid: 1000, cashbackRate: 0.01, cashback: 10,
          currency: "INR", plantedAt: new Date().toISOString(),
        }],
        avgYearsToTarget: 38,
        payLaterLimit: 10,
      });
    },
  });

  await expect(page.getByTestId("asset-seed-row")).toHaveCount(1);
  await expect(page.getByText("Rahul Verma").first()).toBeVisible();
  await expect(page.getByTestId("assets-empty")).toHaveCount(0);
});

// ═══ TASK 6 — ID history, top-right, last five ═════════════════════════════

const historyEntries = (n) =>
  Array.from({ length: n }, (_, i) => ({
    symbolId: SYMBOLS[i % SYMBOLS.length].repeat(12),
    changedAt: new Date(Date.now() - (i + 1) * 86_400_000).toISOString(),
    replacedBy: SECURE_ID_STR,
  }));

const seedHistory = (symbolId, count) => ({
  fn: (payload) => {
    window.localStorage.setItem(`gloobal.idHistory.${payload.symbolId}`, JSON.stringify(payload.entries));
  },
  arg: { symbolId, entries: historyEntries(count) },
});

test("T6-A: Change Gloobal ID has a history control in the top-right", async ({ page }) => {
  await gotoChangeId(page);
  const button = page.getByTestId("id-history-button");
  await expect(button).toBeVisible();

  // Right of the screen's midpoint, and level with the header — a corner
  // control, not another row in the body.
  const box = await button.boundingBox();
  const viewport = page.viewportSize();
  expect(box.x).toBeGreaterThan(viewport.width / 2);
  expect(box.y).toBeLessThan(140);

  // And the old inline section is gone from the body.
  await expect(page.getByText("Previous IDs", { exact: true })).toHaveCount(0);
});

test("T6-B: Tapping it opens the sheet with the previous ID and its date", async ({ page }) => {
  const seed = seedHistory(SECURE_ID_STR, 1);
  await gotoChangeId(page, undefined, seed);
  await page.getByTestId("id-history-button").click();

  await expect(page.getByText("ID History", { exact: true })).toBeVisible();
  const row = page.getByTestId("id-history-row").first();
  await expect(row).toBeVisible();
  await expect(row).toContainText(seed.arg.entries[0].symbolId);
  // Format changed 2026-07-31: rows now carry an action label and a full
  // timestamp down to the second, not "changed on <date>".
  await expect(row).toContainText(/Changed from:/);
  await expect(row).toContainText(/\d{2} \w{3} \d{4} · \d{2}:\d{2}:\d{2}/);
});

test("T6-C: The sheet shows at most five entries, newest first", async ({ page }) => {
  const seed = seedHistory(SECURE_ID_STR, 7);
  await gotoChangeId(page, undefined, seed);
  await page.getByTestId("id-history-button").click();

  await expect(page.getByTestId("id-history-row")).toHaveCount(5);
  // Newest first: the entry changed one day ago heads the list.
  await expect(page.getByTestId("id-history-row").first()).toContainText(seed.arg.entries[0].symbolId);
});

test("T6-D: With no history the sheet says so", async ({ page }) => {
  await gotoChangeId(page);
  await page.getByTestId("id-history-button").click();
  await expect(page.getByText("ID History", { exact: true })).toBeVisible();
  await expect(page.getByTestId("id-history-empty")).toHaveText("No previous IDs");
});

// Every check-in answered for today. The keys are `<pillar>.<item>` and the
// answers carry points, matching what GHScoreScreen persists.
const GH_ANSWER_KEYS = [
  ["self.health", "yesno"], ["self.education", "math"], ["self.food", "yesno"], ["self.mental", "yesno"], ["self.sleep", "yesno"],
  ["community.belonging", "yesno"], ["community.support", "yesno"], ["community.trust", "yesno"], ["community.voice", "math"], ["community.family", "yesno"],
  ["environment.recycling", "yesno"], ["environment.energy", "yesno"], ["environment.nature", "yesno"], ["environment.awareness", "math"], ["environment.water", "yesno"],
  ["finance.savings", "yesno"], ["finance.budgeting", "math"], ["finance.debt", "yesno"], ["finance.security", "yesno"], ["finance.insurance", "yesno"],
];

const seedEveryGHAnswer = (symbolId) => ({
  fn: (payload) => {
    const day = new Date().toISOString().slice(0, 10);
    const answers = {};
    for (const [key, type] of payload.keys) {
      answers[key] =
        type === "yesno"
          ? { type: "yesno", value: "yes", points: 25, day }
          : { type: "math", value: "42", correct: true, points: 25, day };
    }
    window.localStorage.setItem(`gloobal.ghAnswers.${payload.symbolId}`, JSON.stringify(answers));
  },
  arg: { symbolId, keys: GH_ANSWER_KEYS },
});

// ═══ TASK 7 — Profile rows ═════════════════════════════════════════════════

test('T7-A: Profile has no "Currency" row', async ({ page }) => {
  await gotoProfile(page);
  await expect(page.getByRole("button", { name: "Currency", exact: true })).toHaveCount(0);
});

test('T7-B: Profile has no "Subscriptions" row', async ({ page }) => {
  await gotoProfile(page);
  await expect(page.getByRole("button", { name: "Subscriptions", exact: true })).toHaveCount(0);
  await expect(page.getByText("Netflix", { exact: true })).toHaveCount(0);
});

test("T7-C: The rows either side of them are untouched", async ({ page }) => {
  await gotoProfile(page);
  for (const row of ["Personal Details", "Paid", "Received", "Language", "Security", "About"]) {
    await expect(page.getByRole("button", { name: row, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "My GH Score", exact: true })).toBeVisible();
});

// ═══ TASK 8 — new GH Score component ═══════════════════════════════════════
// UNBLOCKED 2026-07-31. The founder's GHScore.jsx arrived and was ported into
// components/profile/GHScoreScreen.jsx, replacing the previous screen. These
// five ran skipped across two sessions waiting for it; they now drive the
// ported component for real.

async function gotoGHScore(page, overrides, initScript) {
  await gotoProfile(page, overrides, initScript);
  await page.getByRole("button", { name: "My GH Score", exact: true }).click();
  await expect(page.getByTestId("gh-category-self")).toBeVisible({ timeout: 30_000 });
}

test("T8-A: GH Score categories screen shows the segmented ring", async ({ page }) => {
  await gotoGHScore(page);
  const ring = page.getByTestId("gh-ring");
  await expect(ring).toBeVisible();
  // Four coloured quadrants, one per pillar, drawn as a conic gradient.
  const background = await ring.locator("div").first().evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(background).toContain("conic-gradient");
  for (const color of ["124, 58, 237", "249, 115, 22", "20, 184, 166", "236, 72, 153"]) {
    expect(background).toContain(color);
  }
});

test("T8-B: All four pillars are visible", async ({ page }) => {
  await gotoGHScore(page);
  for (const [key, label] of [["self", "Self"], ["community", "Community"], ["environment", "Environment"], ["finance", "Finance"]]) {
    await expect(page.getByTestId(`gh-category-${key}`)).toContainText(label);
    await expect(page.getByTestId(`gh-progress-${key}`)).toHaveText("0/5");
  }
  await expect(page.getByTestId("gh-progress")).toContainText("0/20");
});

test("T8-C: The colour sheet opens from the header", async ({ page }) => {
  await gotoGHScore(page);
  await expect(page.getByTestId("gh-color-sheet")).toHaveCount(0);

  await page.getByTestId("gh-color-open").click();

  await expect(page.getByTestId("gh-color-sheet")).toBeVisible();
  await expect(page.getByTestId("gh-color-wheel")).toBeVisible();
  // A tab per pillar, and a way to put every colour back.
  for (const key of ["self", "community", "environment", "finance"]) {
    await expect(page.getByTestId(`gh-color-tab-${key}`)).toBeVisible();
  }
  await expect(page.getByTestId("gh-color-reset")).toBeVisible();
  await expect(page.getByTestId("gh-color-save")).toBeVisible();
});

test("T8-D: Finance locks permanently after answering", async ({ page }) => {
  await gotoGHScore(page);
  await page.getByTestId("gh-category-finance").click();
  await page.getByTestId("gh-item-finance-savings").click();
  await page.getByTestId("gh-answer-yes").click();

  await expect(page.getByTestId("gh-lock-finance-savings")).toBeVisible();
  await expect(page.getByTestId("gh-item-finance-savings")).toBeDisabled();

  // Still locked after a reload — "permanently" has to survive the process.
  await page.reload({ waitUntil: "domcontentloaded" });
  await unlockRestoredSession(page);
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "My GH Score", exact: true }).click();
  await page.getByTestId("gh-category-finance").click();
  await expect(page.getByTestId("gh-lock-finance-savings")).toBeVisible();
  await expect(page.getByTestId("gh-item-finance-savings")).toBeDisabled();
});

test("T8-E: The score auto-reveals once every check-in is done", async ({ page }) => {
  await gotoGHScore(page, undefined, seedEveryGHAnswer(SECURE_ID_STR));

  // No Generate button was ever tapped — the ring already carries the number.
  await expect(page.getByTestId("gh-progress")).toContainText("All check-ins complete");
  await expect(page.getByTestId("gh-tier")).toBeVisible();
  await expect(page.getByTestId("gh-score-value")).toHaveText(/^\d+$/);
  await expect(page.getByTestId("gh-generate")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Generate/i })).toHaveCount(0);
});
