// Verification for the four 2026-07-23 fixes:
//   1. Country-code lock on login (backend guard + frontend lock).
//   2. Face ID / Fingerprint moved off the PIN screen onto their own screen.
//   3. Symbol names in the Gloobal Symbols sheet + less language-dependent
//      referral sheet.
//   4. Real referrals: stored at registration, read back by
//      GET /api/referrals/:symbolId and rendered in My Referral Network.
//
// Every stub is scoped to the backend's own origin. A broader glob like
// "**/api/**" also matches the app's own module URL
// /src/services/api/authApi.js under Vite — fulfilling that with JSON
// breaks the module graph and the app never mounts.
import { test, expect } from "@playwright/test";

const BACKEND = "https://gloobal-pay.onrender.com";
const SYMBOLS = ["−", "+", "×", "=", "○", "□", "●", "■"];
const SECURE_ID = Array.from({ length: 12 }, (_, i) => SYMBOLS[i % SYMBOLS.length]);
const SECURE_ID_STR = SECURE_ID.join("");
const REFERRAL_ID = Array.from({ length: 12 }, (_, i) => SYMBOLS[(i + 3) % SYMBOLS.length]);
const MOBILE = "8114491364";
const OTP = "123456";
const PIN = "123456";

const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

const USER = {
  symbolId: SECURE_ID_STR,
  fullName: "+91" + MOBILE,
  mobileNumber: "+91" + MOBILE,
  referralCount: 0,
  hasPin: true,
  hasPasskey: false,
};

// The backend surfaces its errors under `message` (httpClient reads that
// key); the country-code guard also sets `error` per the spec, so both are
// mirrored here the way the real route answers.
const bothKeys = (text) => ({ error: text, message: text });

/**
 * Full backend stub. `overrides` maps a URL fragment to a route handler
 * result, letting each test bend one endpoint without restating the rest.
 */
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
    if (url.includes("/api/register-symbol")) return route.fulfill(json({ user: USER }, 201));
    if (url.includes("/api/pin/set")) return route.fulfill(json({ user: USER }));
    if (url.includes("/api/login")) return route.fulfill(json({ user: USER }));
    if (url.includes("/api/referrals/")) return route.fulfill(json({ referrals: [], total: 0 }));
    if (url.includes("/api/users/resolve")) {
      const identifier = decodeURIComponent(new URL(url).searchParams.get("identifier") || "");
      // A mobile number belongs to the fake account; a Secure ID being
      // *created* must come back unclaimed, since the creation step checks
      // availability through this same endpoint.
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

/** Swaps the registration screen's country via the picker overlay. */
async function pickCountry(page, label) {
  await page.getByRole("button", { name: /^Country: .*Tap to change$/i }).click();
  await page.getByRole("button", { name: label, exact: true }).first().click();
  await expect(page.getByRole("button", { name: new RegExp(`^Country: ${label.split(",")[0]}`, "i") })).toBeVisible();
}

/** Landing -> OTP -> Secure ID creation (registration path). */
async function gotoSecureIdCreation(page, overrides) {
  await gotoHome(page, overrides);
  await page.getByRole("button", { name: /Phone number/i }).click();
  await tapDigits(page, MOBILE);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText(/VERIFY OTP/i)).toBeVisible({ timeout: 30_000 });
  await tapDigits(page, OTP);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
}

/** ...on to the Referral step. */
async function gotoReferral(page, overrides) {
  await gotoSecureIdCreation(page, overrides);
  await tapSymbols(page, SECURE_ID);
  await page.getByRole("button", { name: "IN", exact: true }).click();
  await expect(page.getByRole("button", { name: /Skip for now/i })).toBeVisible({ timeout: 30_000 });
}

/** Landing -> flip to login -> Secure ID -> PIN entry (stage "loginAuth"). */
async function gotoLoginAuth(page, overrides) {
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

/** Dashboard -> Profile tab -> My Referral Network overlay. */
async function gotoReferralNetwork(page, overrides) {
  await gotoDashboard(page, overrides);
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByText("My Referral Network", { exact: true }).click();
  await expect(page.getByText(/People you've referred/i)).toBeVisible({ timeout: 30_000 });
}

// ─── FIX 1 — country code lock ─────────────────────────────────────────────

test.describe("Fix 1 — country code lock", () => {
  test("F1-A: OTP send is blocked when country code mismatches registered number", async ({ page }) => {
    await gotoHome(page, {
      "/api/otp/send": () => json(bothKeys("Country code does not match the registered number."), 400),
    });

    await pickCountry(page, "United Kingdom, +44");
    await page.getByRole("button", { name: /Phone number/i }).click();
    await tapDigits(page, MOBILE);
    await page.getByRole("button", { name: "Log in", exact: true }).click();

    await expect(page.getByText(/Country code does not match/i)).toBeVisible({ timeout: 30_000 });
    // Still on the phone step — no OTP card, no OTP dial pad.
    await expect(page.getByText(/VERIFY OTP/i)).toHaveCount(0);
  });

  test("F1-B: login by mobile locks the country picker and proceeds", async ({ page }) => {
    await gotoHome(page);

    await page.getByRole("button", { name: /Flip to log in/i }).click();
    await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /Switch to mobile number/i }).click();
    await tapDigits(page, MOBILE);

    // The resolve answered with +91…, matching the selected India flag, so
    // the chip freezes on it and the padlock badge appears.
    const countryChip = page.getByRole("button", { name: /^Country locked to /i });
    await expect(countryChip).toBeVisible({ timeout: 30_000 });
    await expect(countryChip).toBeDisabled();
    await expect(page.getByTestId("country-lock")).toBeVisible();

    // The mobile-login path has no OTP step of its own — it resolves the
    // Secure ID behind the number and continues into PIN verification.
    await page.getByRole("button", { name: "Log in", exact: true }).last().click();
    await expect(page.getByText(/Verify it's you/i)).toBeVisible({ timeout: 30_000 });
  });

  test("F1-C: the backend's 400 for a mismatched prefix is shown to the user", async ({ page }) => {
    const sendCalls = [];
    await gotoHome(page, {
      "/api/otp/send": (route) => {
        const body = route.request().postDataJSON() || {};
        sendCalls.push(body.mobileNumber);
        return String(body.mobileNumber || "").startsWith("+44")
          ? json(bothKeys("Country code does not match the registered number."), 400)
          : json({ message: "Prototype OTP sent successfully." });
      },
    });

    await pickCountry(page, "United Kingdom, +44");
    await page.getByRole("button", { name: /Phone number/i }).click();
    await tapDigits(page, MOBILE);
    await page.getByRole("button", { name: "Log in", exact: true }).click();

    await expect(page.getByText("Country code does not match the registered number.")).toBeVisible({ timeout: 30_000 });
    expect(sendCalls).toContain("+44" + MOBILE);
  });
});

// ─── FIX 2 — biometrics off the PIN screen ─────────────────────────────────

test.describe("Fix 2 — biometrics separated from PIN", () => {
  test("F2-A: PIN screen shows no Face ID or Fingerprint buttons", async ({ page }) => {
    await gotoLoginAuth(page);
    await expect(page.getByRole("button", { name: /Verify with Face ID/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Verify with fingerprint/i })).toHaveCount(0);
    await expect(page.getByText("Face ID", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Fingerprint", { exact: true })).toHaveCount(0);
  });

  test("F2-B: the biometric link is visible on the PIN screen", async ({ page }) => {
    await gotoLoginAuth(page);
    const link = page.getByRole("button", { name: "Use Face ID / Fingerprint instead" });
    await expect(link).toBeVisible();
    const fontSize = await link.evaluate((el) => getComputedStyle(el).fontSize);
    expect(parseFloat(fontSize)).toBeCloseTo(13, 0);
  });

  test("F2-C: tapping the link opens a full-size biometric screen with a back button", async ({ page }) => {
    await gotoLoginAuth(page);
    await page.getByRole("button", { name: "Use Face ID / Fingerprint instead" }).click();

    for (const name of [/Verify with Face ID/i, /Verify with fingerprint/i]) {
      const circle = page.getByRole("button", { name }).locator("span").first();
      await expect(circle).toBeVisible({ timeout: 30_000 });
      const box = await circle.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(80);
      expect(box.height).toBeGreaterThanOrEqual(80);
    }
    await expect(page.getByRole("button", { name: "Back", exact: true })).toBeVisible();
    // The PIN pad does not follow onto this screen.
    await expect(page.getByRole("button", { name: "Digit 1", exact: true })).toHaveCount(0);
  });

  test("F2-D: back from the biometric screen returns to the PIN screen with state intact", async ({ page }) => {
    await gotoLoginAuth(page);
    await tapDigits(page, "12");
    await expect(page.getByText("2/6")).toBeVisible();

    await page.getByRole("button", { name: "Use Face ID / Fingerprint instead" }).click();
    await expect(page.getByRole("button", { name: /Verify with Face ID/i })).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByRole("button", { name: "Digit 1", exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Use Face ID / Fingerprint instead" })).toBeVisible();
    // The two digits typed before the detour are still there.
    await expect(page.getByText("2/6")).toBeVisible();
  });
});

// ─── FIX 3 — symbol names + referral sheet ─────────────────────────────────

test.describe("Fix 3 — less language-dependent info sheets", () => {
  test("F3-A: the Gloobal Symbols sheet names every symbol", async ({ page }) => {
    await gotoSecureIdCreation(page);
    await page.getByRole("button", { name: /What is a Gloobal ID/i }).click();
    await expect(page.getByText("Gloobal Symbols", { exact: true })).toBeVisible({ timeout: 30_000 });

    for (const name of ["minus", "plus", "cross", "equal", "circle", "square", "dot", "block"]) {
      await expect(page.getByText(name, { exact: true })).toBeVisible();
    }
  });

  test("F3-B: the referral sheet carries a wordless flow in the referral code card", async ({ page }) => {
    await gotoReferral(page);
    await page.getByRole("button", { name: /What is a referral/i }).click();

    const card = page.getByText("Your referral code", { exact: true }).locator("xpath=..");
    await expect(card).toBeVisible({ timeout: 30_000 });
    const flow = card.getByLabel(/You share your Gloobal ID/i);
    await expect(flow).toBeVisible();
    await expect(flow).toContainText("👤");
    await expect(flow).toContainText("🔗");
    await expect(flow).toContainText("👥");
    await expect(flow).toContainText("✅");
  });

  test("F3-C: the benefit icons are no longer three identical gift boxes", async ({ page }) => {
    await gotoReferral(page);
    await page.getByRole("button", { name: /What is a referral/i }).click();

    const network = page.getByText("Grow your network", { exact: true }).locator("xpath=../..");
    await expect(network).toBeVisible({ timeout: 30_000 });
    await expect(network).toContainText("🌐");

    const noLimit = page.getByText("No limit", { exact: true }).locator("xpath=../..");
    await expect(noLimit).toContainText("∞");

    // "Earn together" keeps the gift — it's the only card that should still
    // have an SVG glyph rather than a text/emoji mark.
    const earn = page.getByText("Earn together", { exact: true }).locator("xpath=../..");
    await expect(earn.locator("svg")).toHaveCount(1);
    await expect(network.locator("svg")).toHaveCount(0);
    await expect(noLimit.locator("svg")).toHaveCount(0);
  });
});

// ─── FIX 4 — real referrals ────────────────────────────────────────────────

test.describe("Fix 4 — real referrals", () => {
  test("F4-A: registering with a referral code posts it and never errors out", async ({ page }) => {
    const registerBodies = [];
    await gotoReferral(page, {
      "/api/register-symbol": (route) => {
        registerBodies.push(route.request().postDataJSON());
        return json({ user: USER, referralApplied: true }, 201);
      },
      // The referral step now checks the code belongs to a real account
      // before registering (2026-07-24: a code matching nobody used to be
      // dropped silently). The base mock answers 404 for every symbolId so
      // that a Secure ID being *created* reads as unclaimed — correct there,
      // wrong for a referrer, who by definition already exists.
      "/api/users/resolve": (route) => {
        const identifier = decodeURIComponent(new URL(route.request().url()).searchParams.get("identifier") || "");
        if (identifier === REFERRAL_ID.join("")) {
          return json({ success: true, user: { ...USER, symbolId: identifier } });
        }
        if (/^\+?\d+$/.test(identifier)) return json({ success: true, user: USER });
        return json({ user: null }, 404);
      },
    });

    await tapSymbols(page, REFERRAL_ID);
    await page.getByRole("button", { name: "IN", exact: true }).click();

    // Registration completed — the PIN step is next, and no error surfaced.
    await expect(page.getByText("0/6")).toBeVisible({ timeout: 30_000 });
    expect(registerBodies).toHaveLength(1);
    expect(registerBodies[0].referredBy).toBe(REFERRAL_ID.join(""));
    expect(registerBodies[0].symbolId).toBe(SECURE_ID_STR);
  });

  test("F4-B: My Referral Network renders what GET /api/referrals returns", async ({ page }) => {
    const requested = [];
    await gotoReferralNetwork(page, {
      "/api/referrals/": (route) => {
        requested.push(decodeURIComponent(new URL(route.request().url()).pathname));
        return json({
          referrals: [
            { referredSymbolId: "+−×=○□●■+−×=", createdAt: "2026-07-22T00:00:00Z", status: "completed" },
          ],
          total: 1,
        });
      },
    });

    await expect(page.getByText("+−×=○□●■+−×=", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("22 Jul 2026", { exact: true })).toBeVisible();
    expect(requested.join("")).toContain("/api/referrals/");
  });

  test("F4-C: the empty state names the next action", async ({ page }) => {
    await gotoReferralNetwork(page, {
      "/api/referrals/": () => json({ referrals: [], total: 0 }),
    });
    await expect(page.getByText(/No referrals yet/i)).toBeVisible({ timeout: 30_000 });
  });

  test("F4-D: a failed fetch shows an error and a working retry", async ({ page }) => {
    let calls = 0;
    await gotoReferralNetwork(page, {
      "/api/referrals/": () => {
        calls += 1;
        return calls === 1
          ? json({ message: "Server error while loading referrals." }, 500)
          : json({ referrals: [], total: 0 });
      },
    });

    await expect(page.getByText(/Could not load referrals/i)).toBeVisible({ timeout: 30_000 });
    const retry = page.getByRole("button", { name: "Retry", exact: true });
    await expect(retry).toBeVisible();

    await retry.click();
    await expect(page.getByText(/No referrals yet/i)).toBeVisible({ timeout: 30_000 });
    expect(calls).toBeGreaterThanOrEqual(2);
  });
});
