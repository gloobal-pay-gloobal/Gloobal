// Verification for the referral share-link encoding fix.
//
// A Gloobal ID is 12 Unicode symbols (■ □ ● ○ + − × =). Dropped raw into
// a URL path they either fail to linkify or, worse, survive as a bare "+"
// that is read back as a space — so the referral resolved to the wrong ID
// or 404'd. The fix percent-encodes the ID into the link with
// encodeURIComponent, keeps the raw symbols only in the human-readable
// part of the share message, resolves /r/:symbolId on the backend, and
// pre-fills ?ref= on the registration side.
//
// Every stub is scoped to the backend's own origin. A broader glob like
// "**/api/**" also matches the app's own module URL
// /src/services/api/authApi.js under Vite — fulfilling that with JSON
// breaks the module graph and the app never mounts.
import { test, expect } from "@playwright/test";

const BACKEND = "https://gloobal-pay.onrender.com";
const SYMBOLS = ["−", "+", "×", "=", "○", "□", "●", "■"];

// The exact ID from the bug report: ten blocks, a square, a plus. The plus
// on the end is the whole point — it is the character that silently breaks
// when it is not encoded.
const SYMBOL_ID = "■■■■■■■■■■□+";
const ENCODED_ID = "%E2%96%A0%E2%96%A0%E2%96%A0%E2%96%A0%E2%96%A0%E2%96%A0%E2%96%A0%E2%96%A0%E2%96%A0%E2%96%A0%E2%96%A1%2B";
// The link base moved off the hardcoded https://gloobal.id on 2026-07-24:
// that domain does not resolve at all ("Non-existent domain"), so correctly
// encoded links were still dead on arrival. It now defaults to the backend
// that actually serves GET /r/:symbolId, overridable via
// VITE_REFERRAL_LINK_BASE once the real domain exists.
const LINK_BASE = "https://gloobal-pay.onrender.com";
const EXPECTED_LINK = `${LINK_BASE}/r/${ENCODED_ID}`;

// A different 12-symbol ID, used as the "I'd rather use this one" code.
const OTHER_ID = Array.from({ length: 12 }, (_, i) => SYMBOLS[i % SYMBOLS.length]);

const MOBILE = "8114491364";
const OTP = "123456";

const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

const USER = {
  symbolId: SYMBOL_ID,
  fullName: "+91" + MOBILE,
  mobileNumber: "+91" + MOBILE,
  referralCount: 0,
  hasPin: true,
  hasPasskey: false,
};

async function mockBackend(page) {
  await page.route(`${BACKEND}/**`, async (route) => {
    const url = route.request().url();
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

/**
 * Headless Chromium has no Web Share API, so the app would always fall
 * through to its clipboard branch. This installs a recording stand-in so
 * the share payload itself can be asserted on.
 */
async function stubWebShare(page) {
  await page.addInitScript(() => {
    window.__sharePayloads = [];
    Object.defineProperty(window.navigator, "share", {
      configurable: true,
      writable: true,
      value: (data) => {
        window.__sharePayloads.push(data);
        return Promise.resolve();
      },
    });
  });
}

const tapDigits = async (page, digits) => {
  for (const d of digits) await page.getByRole("button", { name: `Digit ${d}`, exact: true }).first().click();
};

const tapSymbols = async (page, symbols) => {
  for (const s of symbols) await page.getByRole("button", { name: `Symbol ${s}`, exact: true }).click();
};

/** Boots straight onto the dashboard by seeding the persisted session. */
async function gotoDashboard(page) {
  await mockBackend(page);
  await page.addInitScript((user) => {
    window.localStorage.setItem(
      "gloobal.session.v1",
      JSON.stringify({ user, phoneNumber: "8114491364", savedAt: Date.now() })
    );
  }, USER);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toBeVisible({ timeout: 30_000 });
}

/** Dashboard -> Profile -> My Network -> Share your Gloobal ID. */
async function gotoShareScreen(page) {
  await gotoDashboard(page);
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "My Network", exact: true }).click();
  await page.getByRole("button", { name: /Share your referral link/i }).click();
  await expect(page.getByText("Share your Gloobal ID", { exact: true })).toBeVisible({ timeout: 30_000 });
}

/**
 * Registration path, entered at a given URL (so ?ref= can be carried in),
 * run through to the Referral step.
 */
async function gotoReferralStage(page, url) {
  await mockBackend(page);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /Phone number/i })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Phone number/i }).click();
  await tapDigits(page, MOBILE);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText(/VERIFY OTP/i)).toBeVisible({ timeout: 30_000 });
  await tapDigits(page, OTP);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
  await tapSymbols(page, OTHER_ID);
  await page.getByRole("button", { name: "IN", exact: true }).click();
  await expect(page.getByRole("button", { name: /Skip for now/i })).toBeVisible({ timeout: 30_000 });
}

/** The referral step's chip row, read back as the symbols it displays. */
const referralChips = (page) => page.getByLabel(/^\d+ of 12 entered$/);
const chipText = async (page) => (await referralChips(page).innerText()).replace(/\s/g, "");

// ─── FIX 1 — the link is encoded ───────────────────────────────────────────

test("RL-A: Share link contains encodeURIComponent-encoded symbolId", async ({ page }) => {
  await stubWebShare(page);
  await gotoShareScreen(page);

  await page.getByRole("button", { name: "Share", exact: true }).click();

  const payload = await page.evaluate(() => window.__sharePayloads[0]);
  expect(payload).toBeTruthy();

  expect(payload.url).toBe(EXPECTED_LINK);
  // The + must be encoded — unencoded it decodes back to a space.
  expect(payload.url).toContain("%2B");
  expect(payload.url).not.toMatch(/\+/);
  expect(payload.url).toContain("%E2%96%A0");
  expect(payload.url).not.toContain("■");
  expect(payload.url).not.toContain("□");
});

// ─── FIX 3 — copy button copies that same encoded link ─────────────────────

test("RL-B: Copy button copies the encoded URL to clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await gotoShareScreen(page);

  await page.getByRole("button", { name: "Copy", exact: true }).click();
  // The toast renders once per stacked overlay (referral + share), so this
  // deliberately matches the first of them rather than asserting on count.
  await expect(page.getByText(/Link copied/i).first()).toBeVisible({ timeout: 10_000 });

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toBe(EXPECTED_LINK);
  expect(clipboard).not.toContain("■");
  expect(clipboard).not.toMatch(/\+/);
});

// ─── FIX 1 — readable symbols in the body, encoded symbols in the link ─────

test("RL-C: Share message text shows raw symbols but link is encoded", async ({ page }) => {
  await stubWebShare(page);
  await gotoShareScreen(page);

  await page.getByRole("button", { name: "Share", exact: true }).click();

  const payload = await page.evaluate(() => window.__sharePayloads[0]);
  expect(payload).toBeTruthy();

  // Human-readable half: the ID exactly as it looks in the app.
  expect(payload.text).toContain(SYMBOL_ID);
  // Machine half: the same ID, percent-encoded, inside the link.
  expect(payload.text).toContain(ENCODED_ID);
  expect(payload.url).toContain("%E2%96%A0");
  expect(payload.url).toContain("%2B");
});

// ─── FIX 4 — ?ref= pre-fills the referral step ─────────────────────────────

test("RL-D: Arriving via ?ref= URL pre-fills referral code on registration screen", async ({ page }) => {
  await gotoReferralStage(page, `/?ref=${ENCODED_ID}`);

  await expect(referralChips(page)).toHaveAttribute("aria-label", "12 of 12 entered");
  expect(await chipText(page)).toBe(SYMBOL_ID);

  await expect(page.getByText("Referral applied", { exact: true })).toBeVisible();
  await expect(page.getByText("✅", { exact: true })).toBeVisible();

  // Read-only by default: the delete key on the dial pad does nothing.
  await page.getByRole("button", { name: "Delete last symbol", exact: true }).click();
  await expect(referralChips(page)).toHaveAttribute("aria-label", "12 of 12 entered");
  expect(await chipText(page)).toBe(SYMBOL_ID);
});

test("RL-E: Pre-filled referral code can be cleared and overridden", async ({ page }) => {
  await gotoReferralStage(page, `/?ref=${ENCODED_ID}`);
  await expect(page.getByText("Referral applied", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Use a different code/i }).click();
  await expect(page.getByText("Referral applied", { exact: true })).toHaveCount(0);
  await expect(referralChips(page)).toHaveAttribute("aria-label", "0 of 12 entered");

  await tapSymbols(page, OTHER_ID);
  await expect(referralChips(page)).toHaveAttribute("aria-label", "12 of 12 entered");
  expect(await chipText(page)).toBe(OTHER_ID.join(""));
  expect(await chipText(page)).not.toBe(SYMBOL_ID);
});

// ─── FIX 2 — the backend resolver hands off to ?ref= ───────────────────────

test("RL-F: Backend route decodes symbolId and finds user (mock test)", async ({ page, baseURL }) => {
  await mockBackend(page);

  // Stands in for GET /r/:symbolId on the real backend: decode, look the
  // user up, 302 to the app with the referrer pre-filled. Registered after
  // mockBackend so it wins over that catch-all for this one path.
  await page.route(`${LINK_BASE}/r/**`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    const symbolId = decodeURIComponent(path.replace("/r/", ""));
    if (symbolId !== SYMBOL_ID) {
      return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Referral link is invalid or expired." }) });
    }
    return route.fulfill({ status: 302, headers: { location: `${baseURL}/?ref=${encodeURIComponent(symbolId)}` }, body: "" });
  });

  await page.goto(EXPECTED_LINK, { waitUntil: "domcontentloaded" });

  // Landed on the app, not on a 404 page, with the referrer in the URL.
  expect(new URL(page.url()).origin).toBe(new URL(baseURL).origin);
  expect(new URLSearchParams(new URL(page.url()).search).get("ref")).toBe(SYMBOL_ID);
  await expect(page.getByRole("button", { name: /Phone number/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/invalid or expired/i)).toHaveCount(0);

  // …and that referrer survives all the way to the referral step.
  await page.getByRole("button", { name: /Phone number/i }).click();
  await tapDigits(page, MOBILE);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText(/VERIFY OTP/i)).toBeVisible({ timeout: 30_000 });
  await tapDigits(page, OTP);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
  await tapSymbols(page, OTHER_ID);
  await page.getByRole("button", { name: "IN", exact: true }).click();
  await expect(page.getByText("Referral applied", { exact: true })).toBeVisible({ timeout: 30_000 });
  expect(await chipText(page)).toBe(SYMBOL_ID);
});
