// Verification for the three 2026-07-24 founder reports.
//
// Diagnosis first, and it changed what these tests assert. Two of the three
// reported bugs were NOT where the report pointed:
//
//   Issue 1 — the /api/otp/send country guard is present and works on the
//     deployed backend (probed live: 400 on a mismatched flag). What was
//     actually broken is that logging in by Gloobal ID never mentions a
//     country at all, so the app kept whatever flag was left on the landing
//     screen and presented a +91 account under it. I1-E is that fix.
//   Issue 2 — referral edges do store, end to end (probed live: edge
//     written, referralCount incremented, list endpoint returns it). What
//     was broken is that a code matching *nobody* was silently dropped:
//     201, no referrer, no word to the user. I2-D is that fix.
//   Issue 3 — genuinely absent. Built from scratch.
//
// Every stub is scoped to the backend's own origin. A broader glob like
// "**/api/**" also matches the app's own module URL
// /src/services/api/authApi.js under Vite — fulfilling that with JSON
// breaks the module graph and the app never mounts.
import { test, expect } from "@playwright/test";
import { unlockRestoredSession } from "./helpers/unlock.mjs";

const BACKEND = "https://gloobal-pay.onrender.com";
const SYMBOLS = ["−", "+", "×", "=", "○", "□", "●", "■"];

const SECURE_ID = Array.from({ length: 12 }, (_, i) => SYMBOLS[i % SYMBOLS.length]);
const SECURE_ID_STR = SECURE_ID.join("");
const REFERRER_ID = Array.from({ length: 12 }, (_, i) => SYMBOLS[(i + 3) % SYMBOLS.length]);
const REFERRER_ID_STR = REFERRER_ID.join("");
const NEW_ID = Array.from({ length: 12 }, (_, i) => SYMBOLS[(i + 5) % SYMBOLS.length]);
const NEW_ID_STR = NEW_ID.join("");

const MOBILE = "8114491364";
const OTP = "123456";
const PIN = "123456";

const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
// The backend surfaces errors under `message` (httpClient reads that key);
// the guards also set `error` per spec, so both are mirrored here the way
// the real routes answer.
const bothKeys = (text) => ({ error: text, message: text });

// Registered under India. The whole of Issue 1 turns on this number's
// country being +91 and nothing else.
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
    if (url.includes("/api/pin/verify")) return route.fulfill(json({ verified: true, user: USER }));
    if (url.includes("/api/login")) return route.fulfill(json({ user: USER }));
    if (url.includes("/api/referrals/")) return route.fulfill(json({ referrals: [], total: 0 }));
    if (url.includes("/api/users/resolve")) {
      const identifier = decodeURIComponent(new URL(url).searchParams.get("identifier") || "");
      const isMobile = /^\+?\d+$/.test(identifier);
      return route.fulfill(isMobile ? json({ success: true, user: USER }) : json({ user: null }, 404));
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

async function pickCountry(page, label) {
  await page.getByRole("button", { name: /^Country: .*Tap to change$/i }).click();
  await page.getByRole("button", { name: label, exact: true }).first().click();
  await expect(page.getByRole("button", { name: new RegExp(`^Country: ${label.split(",")[0]}`, "i") })).toBeVisible();
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
  // A restored session now opens the lock screen, not the dashboard.
  await unlockRestoredSession(page);
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toBeVisible({ timeout: 30_000 });
}

/** Dashboard -> Profile tab -> Change Gloobal ID sheet. */
async function gotoChangeId(page, overrides) {
  await gotoDashboard(page, overrides);
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "My Gloobal ID", exact: true }).click();
  await expect(page.getByRole("button", { name: "Update ID", exact: true })).toBeVisible({ timeout: 30_000 });
}

// ═══ ISSUE 1 — country code lock ═══════════════════════════════════════════

test("I1-A: OTP is NOT sent when country code mismatches registered number", async ({ page }) => {
  const mismatch = "Country code does not match the registered number.";
  await gotoHome(page, { "/api/otp/send": () => json(bothKeys(mismatch), 400) });

  await pickCountry(page, "United Kingdom, +44");
  await page.getByRole("button", { name: /Phone number/i }).click();
  await tapDigits(page, MOBILE);
  await page.getByRole("button", { name: "Log in", exact: true }).click();

  await expect(page.getByText(/Country code does not match/i)).toBeVisible({ timeout: 30_000 });
  // Still on the phone step — the OTP stage was never reached.
  await expect(page.getByText(/VERIFY OTP/i)).toHaveCount(0);
});

test("I1-B: OTP IS sent when country code matches registered number", async ({ page }) => {
  await gotoHome(page);

  await page.getByRole("button", { name: /Phone number/i }).click();
  await tapDigits(page, MOBILE);
  await page.getByRole("button", { name: "Log in", exact: true }).click();

  await expect(page.getByText(/VERIFY OTP/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Country code does not match/i)).toHaveCount(0);
});

test("I1-C: CountryPicker is locked after successful phone resolution", async ({ page }) => {
  // The lock lives on the login-by-mobile face — the only screen where a
  // resolved number can freeze the flag it belongs to. (The registration
  // screen has nothing to lock to yet: the account does not exist.)
  await gotoHome(page);
  await page.getByRole("button", { name: /Flip to log in/i }).click();
  await page.getByRole("button", { name: /Use mobile number instead|Switch to mobile/i }).click();
  await tapDigits(page, MOBILE);

  await expect(page.getByTestId("country-lock")).toBeVisible({ timeout: 30_000 });
  const flag = page.getByRole("button", { name: /^Country locked to/i });
  await expect(flag).toBeVisible();
  await expect(flag).toBeDisabled();
});

test("I1-D: Error shown when phone number not found under any country", async ({ page }) => {
  const notFound = "No account found for this number.";
  await gotoHome(page, { "/api/otp/send": () => json(bothKeys(notFound), 404) });

  await page.getByRole("button", { name: /Phone number/i }).click();
  await tapDigits(page, MOBILE);
  await page.getByRole("button", { name: "Log in", exact: true }).click();

  await expect(page.getByText(/No account found/i)).toBeVisible({ timeout: 30_000 });
});

test("I1-E: Gloobal ID login adopts the account's own country, not the picked flag", async ({ page }) => {
  // The actual defect behind "same Gloobal ID any flag": pick any country
  // on the landing screen, log in by ID, and the dashboard used to keep
  // that country for a +91 account.
  // A passkey already on file so this returning user goes straight to the
  // dashboard after the PIN (the post-PIN biometric offer only appears when
  // no passkey exists yet — see fix-verification-2707 F2-D).
  await gotoHome(page, { "/api/passkey/status": () => json({ hasPasskey: true }) });
  await pickCountry(page, "United Kingdom, +44");

  await page.getByRole("button", { name: /Flip to log in/i }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
  await tapSymbols(page, SECURE_ID);
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();
  await expect(page.getByText(/Verify it's you/i)).toBeVisible({ timeout: 30_000 });
  await tapDigits(page, PIN);
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();

  await expect(page.getByRole("button", { name: "Profile", exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Profile", exact: true }).click();

  // The account is +91, so the profile header must say India — not the
  // United Kingdom that was selected before logging in.
  await expect(page.getByText(/\+91 · India/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/\+44 · United Kingdom/)).toHaveCount(0);
});

// ═══ ISSUE 2 — referral storage ════════════════════════════════════════════

test("I2-A: Registration API call includes the referral code in its request body", async ({ page }) => {
  const bodies = [];
  await gotoHome(page, {
    "/api/register-symbol": (route) => {
      bodies.push(JSON.parse(route.request().postData() || "{}"));
      return json({ user: USER, referralApplied: true }, 201);
    },
    // The referral pre-check resolves the referrer to a real account.
    "/api/users/resolve": (route) => {
      const identifier = decodeURIComponent(new URL(route.request().url()).searchParams.get("identifier") || "");
      if (identifier === REFERRER_ID_STR) return json({ success: true, user: { ...USER, symbolId: REFERRER_ID_STR } });
      if (/^\+?\d+$/.test(identifier)) return json({ success: true, user: USER });
      return json({ user: null }, 404);
    },
  });

  await page.getByRole("button", { name: /Phone number/i }).click();
  await tapDigits(page, MOBILE);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText(/VERIFY OTP/i)).toBeVisible({ timeout: 30_000 });
  await tapDigits(page, OTP);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
  await tapSymbols(page, SECURE_ID);
  await page.getByRole("button", { name: "IN", exact: true }).click();
  await expect(page.getByRole("button", { name: /Skip for now/i })).toBeVisible({ timeout: 30_000 });

  await tapSymbols(page, REFERRER_ID);
  await page.getByRole("button", { name: "IN", exact: true }).click();
  await expect(page.getByText(/Set your PIN/i)).toBeVisible({ timeout: 30_000 });

  expect(bodies).toHaveLength(1);
  // `referredBy` is the field the backend actually reads.
  expect(bodies[0].referredBy).toBe(REFERRER_ID_STR);
});

test("I2-B: Referral network renders what GET /api/referrals returns", async ({ page }) => {
  await gotoDashboard(page, {
    "/api/referrals/": () =>
      json({
        referrals: [{ referredSymbolId: SECURE_ID_STR, createdAt: "2026-07-24T00:00:00Z", status: "completed" }],
        total: 1,
      }),
  });

  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "My Network", exact: true }).click();

  await expect(page.getByText(SECURE_ID_STR).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("24 Jul 2026").first()).toBeVisible();
});

test("I2-C: Referral network shows an empty state when no referrals exist", async ({ page }) => {
  await gotoDashboard(page, { "/api/referrals/": () => json({ referrals: [], total: 0 }) });

  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "My Network", exact: true }).click();

  await expect(page.getByText(/No referrals yet/i)).toBeVisible({ timeout: 30_000 });
});

test("I2-D: A referral code matching no account is rejected, not silently dropped", async ({ page }) => {
  const registrations = [];
  await gotoHome(page, {
    "/api/register-symbol": (route) => {
      registrations.push(JSON.parse(route.request().postData() || "{}"));
      return json({ user: USER }, 201);
    },
    // Nothing resolves — the referral code belongs to no one.
    "/api/users/resolve": (route) => {
      const identifier = decodeURIComponent(new URL(route.request().url()).searchParams.get("identifier") || "");
      if (/^\+?\d+$/.test(identifier)) return json({ success: true, user: USER });
      return json({ user: null }, 404);
    },
  });

  await page.getByRole("button", { name: /Phone number/i }).click();
  await tapDigits(page, MOBILE);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText(/VERIFY OTP/i)).toBeVisible({ timeout: 30_000 });
  await tapDigits(page, OTP);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
  await tapSymbols(page, SECURE_ID);
  await page.getByRole("button", { name: "IN", exact: true }).click();
  await expect(page.getByRole("button", { name: /Skip for now/i })).toBeVisible({ timeout: 30_000 });

  await tapSymbols(page, REFERRER_ID);
  await page.getByRole("button", { name: "IN", exact: true }).click();

  await expect(page.getByTestId("referral-error")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("referral-error")).toContainText(/doesn't match any Gloobal ID/i);
  // Held on the referral step, and no account was created behind their back.
  await expect(page.getByRole("button", { name: /Skip for now/i })).toBeVisible();
  expect(registrations).toHaveLength(0);
});

// ═══ ISSUE 3 — change Gloobal ID ═══════════════════════════════════════════

test("I3-A: Profile screen has a Change Gloobal ID row", async ({ page }) => {
  await gotoDashboard(page);
  await page.getByRole("button", { name: "Profile", exact: true }).click();

  await expect(page.getByRole("button", { name: "My Gloobal ID", exact: true })).toBeVisible({ timeout: 30_000 });
});

test("I3-B: Tapping Change Gloobal ID opens the change sheet", async ({ page }) => {
  await gotoChangeId(page);

  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Update ID", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
  // The current ID is shown so the two can be compared before committing.
  await expect(page.getByTestId("current-gloobal-id")).toContainText(SECURE_ID_STR);
});

test("I3-C: Availability check shows Available for a free ID and enables Update", async ({ page }) => {
  await gotoChangeId(page);
  await tapSymbols(page, NEW_ID);

  await expect(page.getByTestId("new-id-available")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Update ID", exact: true })).toBeEnabled();
});

test("I3-D: Update ID stays disabled when the new ID is taken", async ({ page }) => {
  await gotoChangeId(page, {
    "/api/users/resolve": (route) => {
      const identifier = decodeURIComponent(new URL(route.request().url()).searchParams.get("identifier") || "");
      // Every symbol ID comes back owned by somebody.
      if (/^\+?\d+$/.test(identifier)) return json({ success: true, user: USER });
      return json({ success: true, user: { ...USER, symbolId: identifier } });
    },
  });
  await tapSymbols(page, NEW_ID);

  await expect(page.getByTestId("new-id-taken")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Update ID", exact: true })).toBeDisabled();
});

test("I3-E: A successful change updates the displayed ID and shows a toast", async ({ page }) => {
  const patches = [];
  // Since 2026-07-28 the rename is gated on a device confirmation that runs
  // before the request. This browser reports no platform authenticator, so the
  // gate falls back to the account's PIN — see fix-verification-2807.spec.mjs
  // for the gate's own coverage.
  await page.addInitScript(() => {
    window.PublicKeyCredential = { isUserVerifyingPlatformAuthenticatorAvailable: async () => false };
  });
  await gotoChangeId(page, {
    "/api/pin/verify": () => json({ verified: true, user: USER }),
    "/api/profile/change-symbol-id": (route) => {
      patches.push(JSON.parse(route.request().postData() || "{}"));
      return json({ message: "Gloobal ID updated.", newSymbolId: NEW_ID_STR, user: { ...USER, symbolId: NEW_ID_STR } });
    },
  });

  await tapSymbols(page, NEW_ID);
  await expect(page.getByTestId("new-id-available")).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Update ID", exact: true }).click();

  await expect(page.getByTestId("id-biometric-overlay")).toBeVisible({ timeout: 30_000 });
  expect(patches).toHaveLength(0);
  await tapDigits(page, PIN);
  await page.getByTestId("id-pin-confirm").click();

  await expect(page.getByText("Gloobal ID updated successfully")).toBeVisible({ timeout: 30_000 });
  // Sheet closed.
  await expect(page.getByRole("button", { name: "Update ID", exact: true })).toHaveCount(0);

  expect(patches).toHaveLength(1);
  expect(patches[0]).toEqual({ currentSymbolId: SECURE_ID_STR, newSymbolId: NEW_ID_STR });

  // The new ID is what the app now holds — reopening the sheet shows it as
  // the current one, with no sign-out in between.
  await page.getByRole("button", { name: "My Gloobal ID", exact: true }).click();
  await expect(page.getByTestId("current-gloobal-id")).toContainText(NEW_ID_STR);
});

test("I3-F: Cancelling closes the sheet and changes nothing", async ({ page }) => {
  const patches = [];
  await gotoChangeId(page, {
    "/api/profile/change-symbol-id": (route) => {
      patches.push(route.request().method());
      return json({ message: "Gloobal ID updated.", newSymbolId: NEW_ID_STR });
    },
  });

  await tapSymbols(page, NEW_ID.slice(0, 5));
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  await expect(page.getByRole("button", { name: "Update ID", exact: true })).toHaveCount(0);
  expect(patches).toHaveLength(0);

  // Still the original ID.
  await page.getByRole("button", { name: "My Gloobal ID", exact: true }).click();
  await expect(page.getByTestId("current-gloobal-id")).toContainText(SECURE_ID_STR);
});
