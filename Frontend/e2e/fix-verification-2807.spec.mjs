// Verification for the 2026-07-28 founder tasks.
//
//   TASK 1 — GH Score (Gloobal Human Score) on the Profile tab: four pillars,
//     daily-rotating Self/Community/Environment check-ins, permanently locked
//     Finance check-ins, a Generate gate, and answers that survive a reload.
//   TASK 2 — Creator cashback sharing: "My Share" opens after Receive, covers
//     the 0–7% band, live worked example, PATCH /api/creator/cashback-rate.
//   TASK 3 — the Accounts tab carries no demo/placeholder asset content of its
//     own; demo seeds live only inside My Assets.
//   TASK 4 — My Assets: graph up top, data below it.
//   TASK 5 — Profile header: flag one side, photo the other, name (and a
//     connecting line) in the middle, Gloobal logo as the default photo.
//   TASK 6 — Change Gloobal ID: dated ID history, and a mandatory device
//     confirmation that runs BEFORE the rename request.
//   TASK 7 — Send: a Gloobal ID lookup switches the flag to the recipient's
//     own country, and clearing the ID puts it back.
//
// Every stub is scoped to the backend origin. A broader glob would also match
// the app's own Vite module URLs and break the module graph.
import { test, expect } from "@playwright/test";
import { unlockRestoredSession } from "./helpers/unlock.mjs";

const BACKEND = "https://gloobal-pay.onrender.com";
const SYMBOLS = ["−", "+", "×", "=", "○", "□", "●", "■"];
const SECURE_ID = Array.from({ length: 12 }, (_, i) => SYMBOLS[i % SYMBOLS.length]);
const SECURE_ID_STR = SECURE_ID.join("");

// A different 12-symbol ID, used as the rename target and as the recipient in
// the Send tests. Built from the same alphabet so the dial pad can type it.
const OTHER_ID = Array.from({ length: 12 }, (_, i) => SYMBOLS[(i + 3) % SYMBOLS.length]);
const OTHER_ID_STR = OTHER_ID.join("");

const MOBILE = "8114491364";

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
};

// The recipient for the Send tests: registered under India (+91), so a sender
// whose own default is elsewhere must still see the India flag.
const RECIPIENT = {
  symbolId: OTHER_ID_STR,
  fullName: "Rahul Verma",
  mobileNumber: "+918114491364",
  referralCount: 0,
  hasPin: true,
  hasPasskey: false,
};

// My Assets no longer invents seeds for an account that has none, so the
// checks about how a portfolio is laid out are given a real one.
const DAY = 24 * 60 * 60 * 1000;
const WITH_SEEDS = {
  "/api/assets/": (route) =>
    route.request().url().includes("/paylater/")
      ? null
      : json({
          totalAssets: 82.5,
          futureAssets: 3500,
          avgYearsToTarget: 30,
          payLaterLimit: 82.5,
          seeds: [
            { _id: "s1", business: "Telecom Co", category: "Telecom", amountPaid: 1000, cashbackRate: 0.01, cashback: 10, currency: "INR", plantedAt: new Date(Date.now() - 30 * DAY).toISOString() },
            { _id: "s2", business: "Power Board", category: "Electricity", amountPaid: 2500, cashbackRate: 0.02, cashback: 50, currency: "INR", plantedAt: new Date(Date.now() - 60 * DAY).toISOString() },
          ],
        }),
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

/** Boots straight onto the dashboard by seeding the persisted session. The
 * session's own mobile number is what decides the sender's country/flag. */
async function gotoDashboard(page, overrides, initScript, sessionUser = USER) {
  await mockBackend(page, overrides);
  await page.addInitScript((user) => {
    window.localStorage.setItem(
      "gloobal.session.v1",
      JSON.stringify({ user, phoneNumber: "8114491364", savedAt: Date.now() })
    );
  }, sessionUser);
  if (initScript) await page.addInitScript(initScript);
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

async function gotoGHScore(page, overrides) {
  await gotoProfile(page, overrides);
  await page.getByRole("button", { name: "My GH Score", exact: true }).click();
  await expect(page.getByTestId("gh-category-self")).toBeVisible({ timeout: 30_000 });
}

async function gotoChangeId(page, overrides, initScript) {
  await gotoProfile(page, overrides, initScript);
  await page.getByRole("button", { name: "My Gloobal ID", exact: true }).click();
  await expect(page.getByTestId("current-gloobal-id")).toBeVisible({ timeout: 30_000 });
}

/** Send Money, sitting on the Gloobal ID dial pad. */
async function gotoSend(page, overrides) {
  await gotoDashboard(page, overrides);
  await page.getByRole("button", { name: "Pay", exact: true }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
}

// ═══ TASK 1 — GH Score ═════════════════════════════════════════════════════

test("GH-A: GH Score entry appears on Profile screen", async ({ page }) => {
  await gotoProfile(page);
  await expect(page.getByRole("button", { name: "My GH Score", exact: true })).toBeVisible();
});

test("GH-B: Tapping GH Score opens the categories screen with all 4 pillars", async ({ page }) => {
  await gotoGHScore(page);
  for (const pillar of ["Self", "Community", "Environment", "Finance"]) {
    await expect(page.getByTestId(`gh-category-${pillar.toLowerCase()}`)).toContainText(pillar);
  }
});

test("GH-C: Answering a Self question and returning shows progress", async ({ page }) => {
  await gotoGHScore(page);
  await expect(page.getByTestId("gh-progress-self")).toHaveText("0/5");

  await page.getByTestId("gh-category-self").click();
  await page.getByTestId("gh-item-self-health").click();
  await expect(page.getByTestId("gh-question-text")).toBeVisible();
  await page.getByTestId("gh-answer-yes").click();

  // Back on the items list, that check-in reads as answered.
  await expect(page.getByTestId("gh-answered-self-health")).toBeVisible();

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByTestId("gh-progress-self")).toHaveText("1/5");
});

test("GH-D: Finance item locks after answering", async ({ page }) => {
  await gotoGHScore(page);
  await page.getByTestId("gh-category-finance").click();
  await page.getByTestId("gh-item-finance-budgeting").click();
  await page.getByLabel("Your answer").fill("1234");
  await page.getByTestId("gh-submit-math").click();

  // A lock, not a chevron — and the row can no longer be opened.
  await expect(page.getByTestId("gh-lock-finance-budgeting")).toBeVisible();
  await expect(page.getByTestId("gh-item-finance-budgeting")).toBeDisabled();
});

// Updated 2026-07-31: the "Generate Score" button is gone. The score is
// derived from the answers, so there was nothing to generate — it now
// reveals itself when the last check-in lands, and until then the only
// thing on screen is the progress count.
test("GH-E: no Generate button, and progress is shown until every check-in is answered", async ({ page }) => {
  await gotoGHScore(page);
  await expect(page.getByTestId("gh-generate")).toHaveCount(0);
  await expect(page.getByTestId("gh-view-score")).toHaveCount(0);
  await expect(page.getByTestId("gh-progress")).toContainText("0/20");
});

test("GH-F: GH answers persist across page reload", async ({ page }) => {
  await gotoGHScore(page);
  await page.getByTestId("gh-category-self").click();
  await page.getByTestId("gh-item-self-health").click();
  await page.getByTestId("gh-answer-yes").click();
  await expect(page.getByTestId("gh-answered-self-health")).toBeVisible();

  await page.reload({ waitUntil: "domcontentloaded" });
  // A reload re-enters through the lock screen, same as a real relaunch.
  await unlockRestoredSession(page);
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "My GH Score", exact: true }).click();

  await expect(page.getByTestId("gh-progress-self")).toHaveText("1/5");
  await page.getByTestId("gh-category-self").click();
  await expect(page.getByTestId("gh-answered-self-health")).toBeVisible();
});

// ═══ TASK 2 — Creator cashback sharing ═════════════════════════════════════

test("CR-A: The My Share screen appears after tapping Receive", async ({ page }) => {
  await gotoDashboard(page);
  await page.getByRole("button", { name: "Receive", exact: true }).click();
  await expect(page.getByText("My Share", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Choose how much you share with users who pay you/i)).toBeVisible();
});

test("CR-B: The rate control covers the whole 0-7% band", async ({ page }) => {
  await gotoDashboard(page);
  await page.getByRole("button", { name: "Receive", exact: true }).click();
  const slider = page.getByTestId("my-share-slider");
  await expect(slider).toHaveAttribute("min", "0");
  await expect(slider).toHaveAttribute("max", "7");
  // Opens on the account's saved rate, which is 0 for this fixture.
  await expect(page.getByTestId("my-share-rate-input")).toHaveValue("0");
});

test("CR-C: Live example updates when rate changes", async ({ page }) => {
  await gotoDashboard(page);
  await page.getByRole("button", { name: "Receive", exact: true }).click();
  await page.getByTestId("my-share-rate-input").fill("2");
  // 2% of 1,000 is 20 — quoted in the person's own currency, not a hardcoded one.
  await expect(page.getByTestId("my-share-example")).toContainText("1000.00");
  await expect(page.getByTestId("my-share-example")).toContainText("20.00");
});

test('CR-D: "Continue" calls PATCH /api/creator/cashback-rate', async ({ page }) => {
  const patched = [];
  await gotoDashboard(page, {
    "/api/creator/cashback-rate": (route) => {
      patched.push({ method: route.request().method(), body: route.request().postDataJSON() });
      return json({ cashbackRate: (route.request().postDataJSON() || {}).cashbackRate });
    },
  });

  await page.getByRole("button", { name: "Receive", exact: true }).click();
  await page.getByTestId("my-share-rate-input").fill("3");
  await page.getByTestId("my-share-continue").click();

  await expect.poll(() => patched.length).toBeGreaterThan(0);
  expect(patched[0].method).toBe("PATCH");
  expect(patched[0].body.cashbackRate).toBeCloseTo(0.03, 6);
  expect(patched[0].body.symbolId).toBe(SECURE_ID_STR);

  // Saving carries on into the receive sheet rather than dead-ending.
  await expect(page.getByText("Share this Gloobal ID to receive money")).toBeVisible({ timeout: 30_000 });
});

// ═══ TASK 3 — Accounts tab carries no demo data ════════════════════════════

test("AC-A: Accounts tab does not show demo seed rows directly", async ({ page }) => {
  await gotoDashboard(page);
  await page.getByRole("button", { name: "Accounts", exact: true }).click();
  await expect(page.getByRole("button", { name: "My Assets", exact: true })).toBeVisible({ timeout: 30_000 });

  await expect(page.getByText("Demo data", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("asset-seed-row")).toHaveCount(0);
  for (const business of ["Airtel", "BESCOM", "Swiggy", "BookMyShow"]) {
    await expect(page.getByText(business, { exact: true })).toHaveCount(0);
  }
});

test("AC-B: My Assets navigation entry still present on Accounts tab", async ({ page }) => {
  await gotoDashboard(page);
  await page.getByRole("button", { name: "Accounts", exact: true }).click();
  await expect(page.getByRole("button", { name: "My Assets", exact: true })).toBeVisible({ timeout: 30_000 });

  // And it still leads to the full screen — which now says plainly that
  // there is nothing there, rather than filling itself with sample rows.
  await page.getByRole("button", { name: "My Assets", exact: true }).click();
  await expect(page.getByTestId("assets-empty")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("No assets yet", { exact: true })).toBeVisible();
  await expect(page.getByText("Demo data", { exact: true })).toHaveCount(0);
});

// ═══ TASK 4 — My Assets: graph top, data below ═════════════════════════════

test("MA-LAYOUT-A: Growth chart appears above the seed list on My Assets screen", async ({ page }) => {
  await gotoDashboard(page, WITH_SEEDS);
  await page.getByRole("button", { name: "Accounts", exact: true }).click();
  await page.getByRole("button", { name: "My Assets", exact: true }).click();
  await expect(page.getByText("Growing toward")).toBeVisible({ timeout: 30_000 });

  const chart = page.getByTestId("assets-growth-chart");
  await expect(chart).toBeVisible();
  const firstRow = page.getByTestId("asset-seed-row").first();
  await expect(firstRow).toBeVisible();

  const chartBox = await chart.boundingBox();
  const rowBox = await firstRow.boundingBox();
  expect(chartBox.y + chartBox.height).toBeLessThan(rowBox.y);

  // …and still below the total card, which stays the first thing on screen.
  const totalBox = await page.getByText("Growing toward").boundingBox();
  expect(totalBox.y).toBeLessThan(chartBox.y);
});

// ═══ TASK 5 — Profile header ═══════════════════════════════════════════════

test("PR-A: Profile header shows flag on left, name in center, photo on right", async ({ page }) => {
  await gotoProfile(page);
  const header = page.getByTestId("profile-header");
  const name = page.getByTestId("profile-name");
  const photo = page.getByTestId("profile-photo");
  const connector = page.getByTestId("profile-connector");

  await expect(name).toHaveText("Priya Sharma");
  await expect(photo).toBeVisible();
  await expect(connector).toBeVisible();

  const headerBox = await header.boundingBox();
  const nameBox = await name.boundingBox();
  const photoBox = await photo.boundingBox();
  // The flag is the header's first child; the photo is the last.
  const flagBox = await header.locator("> div").first().boundingBox();

  expect(flagBox.x).toBeLessThan(nameBox.x);
  expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(photoBox.x + 1);
  expect(photoBox.x + photoBox.width).toBeLessThanOrEqual(headerBox.x + headerBox.width + 1);
  // Circular photo, near enough 64px square.
  expect(Math.round(photoBox.width)).toBeGreaterThanOrEqual(56);
  expect(Math.abs(photoBox.width - photoBox.height)).toBeLessThan(2);
});

test("PR-B: Default profile photo shows Gloobal logo when no photo uploaded", async ({ page }) => {
  await gotoProfile(page);
  const logo = page.getByTestId("profile-photo-default");
  await expect(logo).toBeVisible();
  const src = await logo.getAttribute("src");
  expect(src).toMatch(/globalid-logo/);
  // Really rendered, not a broken image.
  expect(await logo.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
});

test("PR-C: Tapping profile photo area triggers file input", async ({ page }) => {
  await gotoProfile(page);
  const input = page.getByTestId("profile-photo-input");
  await expect(input).toHaveCount(1);
  await expect(input).toHaveAttribute("type", "file");
  await expect(input).toHaveAttribute("accept", "image/*");

  // Tapping the photo is what opens it.
  const chooser = page.waitForEvent("filechooser");
  await page.getByTestId("profile-photo").click();
  expect(await chooser).toBeTruthy();
});

// ═══ TASK 6 — Change Gloobal ID: history + biometric confirmation ══════════

test("CH-A: ID history opens from the header control", async ({ page }) => {
  // The record moved out of the screen body into a sheet behind the
  // top-right history icon; the empty state it shows is unchanged.
  await gotoChangeId(page);
  await page.getByTestId("id-history-button").click();
  await expect(page.getByText("ID History", { exact: true })).toBeVisible();
  await expect(page.getByTestId("id-history-empty")).toHaveText("No previous IDs");
});

test("CH-B: After a successful ID change, old ID appears in history", async ({ page }) => {
  const patched = [];
  // No platform authenticator on this device, so the confirmation falls back
  // to the PIN — still a confirmation, still ahead of the request.
  await gotoChangeId(
    page,
    {
      // Nobody owns the replacement ID, so it reads as available.
      "/api/users/resolve": () => json({ user: null }, 404),
      "/api/profile/change-symbol-id": (route) => {
        const body = route.request().postDataJSON() || {};
        patched.push(body);
        return json({ newSymbolId: body.newSymbolId, user: { ...USER, symbolId: body.newSymbolId } });
      },
    },
    () => {
      window.PublicKeyCredential = { isUserVerifyingPlatformAuthenticatorAvailable: async () => false };
    }
  );

  await tapSymbols(page, OTHER_ID);
  await expect(page.getByTestId("new-id-available")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Update ID", exact: true }).click();

  // The confirmation gate is up, and nothing has been sent yet.
  await expect(page.getByTestId("id-biometric-overlay")).toBeVisible();
  expect(patched).toHaveLength(0);

  await tapDigits(page, "123456");
  await page.getByTestId("id-pin-confirm").click();
  await expect.poll(() => patched.length).toBe(1);
  expect(patched[0].newSymbolId).toBe(OTHER_ID_STR);

  // Back on Change Gloobal ID, the old ID is on the record with a timestamp.
  await page.getByRole("button", { name: "My Gloobal ID", exact: true }).click();
  await page.getByTestId("id-history-button").click();
  const row = page.getByTestId("id-history-row").first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await expect(row).toContainText(SECURE_ID_STR);
  // Format changed 2026-07-31: an action label plus a full timestamp down to
  // the second, replacing "changed on <date>, <hh:mm>".
  await expect(row).toContainText(/Changed from:/);
  await expect(row).toContainText(/\d{2} \w{3} \d{4} · \d{2}:\d{2}:\d{2}/);
});

test('CH-C: "Update ID" triggers biometric confirmation before API call', async ({ page }) => {
  const patched = [];
  await gotoChangeId(
    page,
    {
      "/api/users/resolve": () => json({ user: null }, 404),
      "/api/profile/change-symbol-id": (route) => {
        patched.push(route.request().postDataJSON());
        return json({ newSymbolId: OTHER_ID_STR, user: USER });
      },
    },
    () => {
      // Record the availability probe and never resolve it, so the rename is
      // held at the gate for as long as the check is outstanding.
      window.__bioProbes = 0;
      window.PublicKeyCredential = {
        isUserVerifyingPlatformAuthenticatorAvailable: () => {
          window.__bioProbes += 1;
          return new Promise(() => {});
        },
      };
    }
  );

  await tapSymbols(page, OTHER_ID);
  await expect(page.getByTestId("new-id-available")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Update ID", exact: true }).click();

  await expect(page.getByTestId("id-biometric-overlay")).toBeVisible();
  await expect(page.getByText(/Confirm with fingerprint or Face ID to update your Gloobal ID/i)).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__bioProbes)).toBeGreaterThan(0);

  // The device never answered, so the rename never went out.
  await page.waitForTimeout(600);
  expect(patched).toHaveLength(0);

  // Cancelling leaves the ID alone.
  await page.getByRole("button", { name: "Cancel", exact: true }).last().click();
  await expect(page.getByTestId("id-biometric-overlay")).toHaveCount(0);
  expect(patched).toHaveLength(0);
});

// ═══ TASK 7 — Send: flag follows the recipient's country ═══════════════════

test("SND-A: Entering a recipient Gloobal ID auto-switches the flag to their country", async ({ page }) => {
  await gotoSend(page);
  await tapSymbols(page, OTHER_ID);

  await expect(page.getByTestId("recipient-found")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("recipient-found")).toContainText("Recipient found ✓");
  await expect(page.getByTestId("recipient-found")).toContainText(OTHER_ID_STR);
  await expect(page.getByTestId("receiver-country")).toHaveAttribute("data-country", "IN");
});

test("SND-B: Flag resets to sender default when recipient ID input is cleared", async ({ page }) => {
  // Sender's own country is the UK here, so a reset back to the sender's
  // default is visibly different from the recipient's India.
  await gotoDashboard(page, undefined, undefined, { ...USER, mobileNumber: "+447700900123" });
  await page.getByRole("button", { name: "Pay", exact: true }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });

  const senderIso = await page.getByTestId("receiver-country").getAttribute("data-country");
  expect(senderIso).toBe("GB");

  await tapSymbols(page, OTHER_ID);
  await expect(page.getByTestId("recipient-found")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("receiver-country")).toHaveAttribute("data-country", "IN");

  // Delete one symbol — the ID is no longer complete, so there is no recipient.
  await page.getByRole("button", { name: "Delete last symbol", exact: true }).click();
  await expect(page.getByTestId("recipient-found")).toHaveCount(0);
  await expect(page.getByTestId("receiver-country")).toHaveAttribute("data-country", senderIso);
});

test('SND-C: Unknown Gloobal ID shows "No user found" error', async ({ page }) => {
  await gotoSend(page, { "/api/users/resolve": () => json({ user: null }, 404) });
  const senderIso = await page.getByTestId("receiver-country").getAttribute("data-country");

  await tapSymbols(page, OTHER_ID);

  await expect(page.getByTestId("recipient-not-found")).toHaveText("No user found for this ID", { timeout: 30_000 });
  await expect(page.getByTestId("recipient-found")).toHaveCount(0);
  await expect(page.getByTestId("receiver-country")).toHaveAttribute("data-country", senderIso);
});
