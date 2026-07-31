// Cross-feature checks for the 2026-07-28 work.
//
// The per-task suite (fix-verification-2807.spec.mjs) proves each feature works
// on its own. This one proves they don't collide: every check drives two or
// more of them in the same session and asserts neither breaks, hides, strands,
// or silently discards the other.
//
// The seven surfaces in play: GH Score, Creator cashback sharing, the Accounts
// tab, My Assets, the Profile header, Change Gloobal ID (history + biometric
// gate), and Send's recipient-country flag.
import { test, expect } from "@playwright/test";
import { unlockRestoredSession } from "./helpers/unlock.mjs";

const BACKEND = "https://gloobal-pay.onrender.com";
const SYMBOLS = ["−", "+", "×", "=", "○", "□", "●", "■"];
const SECURE_ID = Array.from({ length: 12 }, (_, i) => SYMBOLS[i % SYMBOLS.length]);
const SECURE_ID_STR = SECURE_ID.join("");
const NEW_ID = Array.from({ length: 12 }, (_, i) => SYMBOLS[(i + 5) % SYMBOLS.length]);
const NEW_ID_STR = NEW_ID.join("");
const RECIPIENT_ID = Array.from({ length: 12 }, (_, i) => SYMBOLS[(i + 3) % SYMBOLS.length]);
const RECIPIENT_ID_STR = RECIPIENT_ID.join("");

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
};

// Registered under India, so a UK sender must still see the India flag.
const RECIPIENT = {
  symbolId: RECIPIENT_ID_STR,
  fullName: "Rahul Verma",
  mobileNumber: "+918114491364",
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

    if (url.includes("/api/pin/verify")) return route.fulfill(json({ verified: true, user: USER }));
    if (url.includes("/api/login")) return route.fulfill(json({ user: USER }));
    if (url.includes("/api/creator/cashback-rate")) {
      const body = route.request().postDataJSON() || {};
      return route.fulfill(json({ cashbackRate: body.cashbackRate }));
    }
    if (url.includes("/api/referrals/")) return route.fulfill(json({ referrals: [], total: 0 }));
    if (url.includes("/api/assets/paylater/")) return route.fulfill(json({ limit: 142.5, available: 142.5, pendingDues: 0, transactions: [] }));
    if (url.includes("/api/assets/")) return route.fulfill(json({ totalAssets: 0, futureAssets: 0, seeds: [], avgYearsToTarget: 0, payLaterLimit: 0 }));
    if (url.includes("/api/users/resolve")) {
      const identifier = decodeURIComponent(new URL(url).searchParams.get("identifier") || "");
      if (identifier === RECIPIENT_ID_STR) return route.fulfill(json({ success: true, user: RECIPIENT }));
      if (identifier === SECURE_ID_STR || /^\+?\d+$/.test(identifier)) return route.fulfill(json({ success: true, user: USER }));
      // Anything else is unclaimed, which is what makes NEW_ID renameable.
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

/** No platform authenticator, so the ID-change gate falls back to the PIN. */
const noPlatformAuthenticator = () => {
  window.PublicKeyCredential = { isUserVerifyingPlatformAuthenticatorAvailable: async () => false };
};

async function boot(page, overrides, { initScript, sessionUser = USER } = {}) {
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

const goProfile = async (page) => {
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await expect(page.getByTestId("profile-header")).toBeVisible({ timeout: 30_000 });
};
const goHome = (page) => page.getByRole("button", { name: "Home", exact: true }).click();
const goAccounts = (page) => page.getByRole("button", { name: "Accounts", exact: true }).click();

/** Answers one Self check-in from the GH Score categories screen. */
async function answerSelfRest(page) {
  await page.getByTestId("gh-category-self").click();
  await page.getByTestId("gh-item-self-health").click();
  await page.getByTestId("gh-answer-yes").click();
  await expect(page.getByTestId("gh-answered-self-health")).toBeVisible();
}

/** Drives Change Gloobal ID all the way through the confirmation gate. */
async function renameTo(page, symbols) {
  await page.getByRole("button", { name: "My Gloobal ID", exact: true }).click();
  await expect(page.getByTestId("current-gloobal-id")).toBeVisible({ timeout: 30_000 });
  await tapSymbols(page, symbols);
  await expect(page.getByTestId("new-id-available")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Update ID", exact: true }).click();
  await expect(page.getByTestId("id-biometric-overlay")).toBeVisible();
  await tapDigits(page, PIN);
  await page.getByTestId("id-pin-confirm").click();
  await expect(page.getByTestId("id-biometric-overlay")).toHaveCount(0, { timeout: 30_000 });
}

// ═══ X1 — every surface in one session ═════════════════════════════════════

test("X1: all seven surfaces open and close in one session without stranding an overlay", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await boot(page);

  // Receive -> My Share -> receive sheet -> closed.
  await page.getByRole("button", { name: "Receive", exact: true }).click();
  await expect(page.getByTestId("my-share-rate-input")).toBeVisible({ timeout: 30_000 });
  await page.getByTestId("my-share-rate-input").fill("2");
  await page.getByTestId("my-share-continue").click();
  await expect(page.getByText("Share this Gloobal ID to receive money")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Close", exact: true }).first().click();
  await expect(page.getByText("Share this Gloobal ID to receive money")).toHaveCount(0);

  // Accounts -> My Assets -> back.
  await goAccounts(page);
  await page.getByRole("button", { name: "My Assets", exact: true }).click();
  // No seeds on this account, so the screen opens on its empty state — the
  // point here is that it opens and closes without stranding an overlay.
  await expect(page.getByTestId("assets-empty")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "My Assets", exact: true })).toBeVisible();

  // Profile -> GH Score -> back.
  await goProfile(page);
  await page.getByRole("button", { name: "My GH Score", exact: true }).click();
  await expect(page.getByTestId("gh-category-self")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByTestId("profile-header")).toBeVisible();

  // Profile -> Change Gloobal ID -> cancelled.
  await page.getByRole("button", { name: "My Gloobal ID", exact: true }).click();
  // The ID history moved into a sheet behind the header control; the screen
  // itself is reached the same way.
  await expect(page.getByTestId("id-history-button")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByTestId("profile-header")).toBeVisible();

  // Home -> Send -> back. Every screen still reachable at the end.
  await goHome(page);
  await page.getByRole("button", { name: "Pay", exact: true }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Back", exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Receive", exact: true })).toBeVisible({ timeout: 30_000 });

  expect(pageErrors).toEqual([]);
});

// ═══ X2 — GH Score vs. Change Gloobal ID ═══════════════════════════════════

test("X2: GH Score answers survive a Gloobal ID change", async ({ page }) => {
  // GH answers are filed under the account's Gloobal ID — the very thing a
  // rename changes. They have to be carried across, or renaming silently wipes
  // the person's check-ins.
  await boot(page, undefined, { initScript: noPlatformAuthenticator });

  await goProfile(page);
  await page.getByRole("button", { name: "My GH Score", exact: true }).click();
  await answerSelfRest(page);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByTestId("gh-progress-self")).toHaveText("1/5");
  await page.getByRole("button", { name: "Back", exact: true }).click();

  await renameTo(page, NEW_ID);

  // Same person, same device — the answer is still there under the new ID.
  await goProfile(page);
  await page.getByRole("button", { name: "My GH Score", exact: true }).click();
  await expect(page.getByTestId("gh-progress-self")).toHaveText("1/5");
  await expect(page.getByTestId("gh-progress")).toContainText("1/20");

  const stored = await page.evaluate((id) => window.localStorage.getItem(`gloobal.ghAnswers.${id}`), NEW_ID_STR);
  expect(stored).toContain("self.health");
  const orphaned = await page.evaluate((id) => window.localStorage.getItem(`gloobal.ghAnswers.${id}`), SECURE_ID_STR);
  expect(orphaned).toBeNull();

  // No *account data* may be left behind under the old ID. Asserted over
  // every key rather than the one this test happened to write, because the
  // failure mode is a new key being added to the app and forgotten in
  // ID_SCOPED_LOCAL_KEYS — which is exactly how gloobal.ghColors was missed
  // when the GH Score screen was ported.
  //
  // gloobal.lastLogin is excluded deliberately: it is a record of when an ID
  // was last signed in with, not data belonging to the person, and it has
  // never been migrated. Carrying it across would be a change to the login
  // screen's behaviour, which is not what a rename should decide.
  const strays = await page.evaluate(
    (id) =>
      Object.keys(window.localStorage).filter(
        (k) => k.startsWith("gloobal.") && k.endsWith(`.${id}`) && !k.startsWith("gloobal.lastLogin.")
      ),
    SECURE_ID_STR
  );
  expect(strays).toEqual([]);
});

// ═══ X3 — Profile photo vs. Change Gloobal ID ══════════════════════════════

test("X3: the profile photo survives a Gloobal ID change", async ({ page }) => {
  const PHOTO = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
  await boot(page, undefined, {
    initScript: () => {
      window.PublicKeyCredential = { isUserVerifyingPlatformAuthenticatorAvailable: async () => false };
    },
  });

  // Seed a chosen photo for the current ID, then reload so it is read back.
  await page.evaluate(
    ([id, photo]) => window.localStorage.setItem(`gloobal.profilePhoto.${id}`, photo),
    [SECURE_ID_STR, PHOTO]
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  // A reload re-enters through the lock screen, same as a real relaunch.
  await unlockRestoredSession(page);
  await goProfile(page);
  await expect(page.getByTestId("profile-photo-default")).toHaveCount(0);

  await renameTo(page, NEW_ID);

  await goProfile(page);
  // Still their photo, not the logo placeholder.
  await expect(page.getByTestId("profile-photo-default")).toHaveCount(0);
  const carried = await page.evaluate((id) => window.localStorage.getItem(`gloobal.profilePhoto.${id}`), NEW_ID_STR);
  expect(carried).toBe(PHOTO);
});

// ═══ X4 — My Share vs. My Assets ═══════════════════════════════════

test("X4: My Share cross-links into My Assets and back without stranding", async ({ page }) => {
  await boot(page);
  await page.getByRole("button", { name: "Receive", exact: true }).click();
  await expect(page.getByTestId("my-share-rate-input")).toBeVisible({ timeout: 30_000 });

  await page.getByTestId("my-share-assets-link").click();
  // This account has no seeds, so My Assets opens on its empty state.
  await expect(page.getByTestId("assets-empty")).toBeVisible({ timeout: 30_000 });
  // The My Share screen stepped aside rather than stacking underneath.
  await expect(page.getByTestId("my-share-rate-input")).toHaveCount(0);

  await page.getByRole("button", { name: "Back", exact: true }).click();
  // Back on the dashboard with nothing left over, and Receive still works.
  await expect(page.getByRole("button", { name: "Receive", exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Receive", exact: true }).click();
  await expect(page.getByTestId("my-share-rate-input")).toBeVisible({ timeout: 30_000 });
});

test("X5: a saved cashback rate is what the picker reopens on", async ({ page }) => {
  let saved = 0;
  await boot(page, {
    "/api/creator/cashback-rate": (route) => {
      saved = (route.request().postDataJSON() || {}).cashbackRate;
      return json({ cashbackRate: saved });
    },
  });

  await page.getByRole("button", { name: "Receive", exact: true }).click();
  await page.getByTestId("my-share-rate-input").fill("5");
  await page.getByTestId("my-share-continue").click();
  await expect(page.getByText("Share this Gloobal ID to receive money")).toBeVisible({ timeout: 30_000 });
  expect(saved).toBeCloseTo(0.05, 6);

  await page.getByRole("button", { name: "Close", exact: true }).first().click();
  await page.getByRole("button", { name: "Receive", exact: true }).click();
  // Reopens on the rate just chosen, not back at 0%.
  await expect(page.getByTestId("my-share-rate-input")).toHaveValue("5");
});

// ═══ X6 — Send flag vs. the rest of the app ════════════════════════════════

test("X6: the Send flag switch leaves the dashboard's own country alone", async ({ page }) => {
  // Sender is in the UK; the recipient is in India.
  await boot(page, undefined, { sessionUser: { ...USER, mobileNumber: "+447700900123" } });

  await page.getByRole("button", { name: "Pay", exact: true }).click();
  await expect(page.getByTestId("receiver-country")).toHaveAttribute("data-country", "GB");
  await tapSymbols(page, RECIPIENT_ID);
  await expect(page.getByTestId("recipient-found")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("receiver-country")).toHaveAttribute("data-country", "IN");

  await page.getByRole("button", { name: "Back", exact: true }).first().click();
  await goProfile(page);
  // The sender's own country is untouched by whoever they looked up.
  await expect(page.getByTestId("profile-header")).toContainText("+44");
  await expect(page.getByTestId("profile-header")).toContainText("United Kingdom");
});

test("X7: Send still resolves a recipient after a Gloobal ID change", async ({ page }) => {
  const patched = [];
  await boot(
    page,
    {
      "/api/profile/change-symbol-id": (route) => {
        const body = route.request().postDataJSON() || {};
        patched.push(body);
        return json({ newSymbolId: body.newSymbolId, user: { ...USER, symbolId: body.newSymbolId } });
      },
    },
    { initScript: noPlatformAuthenticator }
  );

  await goProfile(page);
  await renameTo(page, NEW_ID);
  expect(patched[0].currentSymbolId).toBe(SECURE_ID_STR);

  // Send now sends *as* the new ID, and still resolves the recipient normally.
  await goHome(page);
  await page.getByRole("button", { name: "Pay", exact: true }).click();
  await tapSymbols(page, RECIPIENT_ID);
  await expect(page.getByTestId("recipient-found")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /^Search/ }).click();
  await expect(page.locator("button.send-btn")).toBeVisible({ timeout: 30_000 });
});

// ═══ X8 — Accounts / My Assets / PayLater triangle ═════════════════════════

test("X8: My Assets and PayLater cross-link both ways with the graph intact", async ({ page }) => {
  // The graph and the per-seed rows only exist for an account that has
  // seeds — My Assets no longer invents them for one that does not.
  await boot(page, {
    "/api/assets/": (route) =>
      route.request().url().includes("/paylater/")
        ? null
        : json({
            totalAssets: 60,
            futureAssets: 3500,
            avgYearsToTarget: 30,
            payLaterLimit: 60,
            seeds: [
              { _id: "s1", business: "Telecom Co", category: "Telecom", amountPaid: 1000, cashbackRate: 0.01, cashback: 10, currency: "INR", plantedAt: new Date(Date.now() - 30 * 86_400_000).toISOString() },
              { _id: "s2", business: "Power Board", category: "Electricity", amountPaid: 2500, cashbackRate: 0.02, cashback: 50, currency: "INR", plantedAt: new Date(Date.now() - 60 * 86_400_000).toISOString() },
            ],
          }),
  });
  await goAccounts(page);

  await page.getByRole("button", { name: "PayLater", exact: true }).click();
  await expect(page.getByText(/Available PayLater balance/i)).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /View My Assets/i }).click();

  // The graph still sits above the per-seed rows when reached this way too.
  const chart = page.getByTestId("assets-growth-chart");
  await expect(chart).toBeVisible({ timeout: 30_000 });
  const chartBox = await chart.boundingBox();
  const rowBox = await page.getByTestId("asset-seed-row").first().boundingBox();
  expect(chartBox.y + chartBox.height).toBeLessThan(rowBox.y);

  await page.getByRole("button", { name: /your PayLater limit/i }).click();
  await expect(page.getByText(/Available PayLater balance/i)).toBeVisible({ timeout: 30_000 });
  // And the Accounts tab is still underneath, not replaced.
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("button", { name: "My Assets", exact: true })).toBeVisible({ timeout: 30_000 });
});

// ═══ X9 — GH Score does not leak into Accounts ═════════════════════════════

test("X9: GH Score lives on Profile only, and Accounts carries no demo asset content", async ({ page }) => {
  await boot(page);

  await goAccounts(page);
  await expect(page.getByRole("button", { name: "My GH Score", exact: true })).toHaveCount(0);
  await expect(page.getByText("Demo data", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("asset-seed-row")).toHaveCount(0);

  await goProfile(page);
  await expect(page.getByRole("button", { name: "My GH Score", exact: true })).toBeVisible();

  // Opening GH Score does not disturb the tab underneath.
  await page.getByRole("button", { name: "My GH Score", exact: true }).click();
  await expect(page.getByTestId("gh-category-finance")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await goAccounts(page);
  await expect(page.getByRole("button", { name: "My Assets", exact: true })).toBeVisible();
});

// ═══ X10 — the ID-change gate cannot be walked around ══════════════════════

test("X10: cancelling the confirmation leaves the ID, the history and the local data alone", async ({ page }) => {
  const patched = [];
  await boot(
    page,
    {
      "/api/profile/change-symbol-id": (route) => {
        patched.push(route.request().postDataJSON());
        return json({ newSymbolId: NEW_ID_STR, user: USER });
      },
    },
    { initScript: noPlatformAuthenticator }
  );

  await goProfile(page);
  await page.getByRole("button", { name: "My GH Score", exact: true }).click();
  await answerSelfRest(page);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();

  await page.getByRole("button", { name: "My Gloobal ID", exact: true }).click();
  await tapSymbols(page, NEW_ID);
  await expect(page.getByTestId("new-id-available")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Update ID", exact: true }).click();
  await expect(page.getByTestId("id-biometric-overlay")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).last().click();

  // Nothing sent, nothing recorded, nothing moved.
  expect(patched).toHaveLength(0);
  await page.getByTestId("id-history-button").click();
  await expect(page.getByTestId("id-history-empty")).toHaveText("No previous IDs");
  await page.getByRole("button", { name: "Close ID history" }).click();
  const stillThere = await page.evaluate((id) => window.localStorage.getItem(`gloobal.ghAnswers.${id}`), SECURE_ID_STR);
  expect(stillThere).toContain("self.health");
});
