// Verification for the two 2026-07-24 (afternoon) founder reports.
//
// Diagnosed against live data before any code was written, and neither bug
// was where the report assumed:
//
//   Bug 1 — the availability logic is NOT inverted. Probed live: the
//     backend returns the right answer for known-taken IDs, and the client
//     derives `available: false` correctly from it. The lie came from the
//     error path — checkSymbolAvailability caught *every* failure (Render
//     cold-start timeout, 5xx, offline) and returned `available: true`, so
//     any backend hiccup rendered a confident green "Available ✓" over an
//     ID that may well be taken. AV-G is that case, and it is the one that
//     reproduces the screenshot.
//   Bug 2 — the encoding fix is present and correct in main. `gloobal.id`
//     simply does not resolve ("Non-existent domain"), so every link was
//     dead on arrival regardless. The link base is now configurable and
//     defaults to the backend that actually serves GET /r/:symbolId.
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
const OTHER_ID = Array.from({ length: 12 }, (_, i) => SYMBOLS[(i + 5) % SYMBOLS.length]);
const OTHER_ID_STR = OTHER_ID.join("");

// The bug-report ID: ten blocks, a square, a plus. The trailing + is what
// breaks a URL when it isn't percent-encoded.
const LINK_ID = "■■■■■■■■■■□+";
const LINK_ID_ENCODED = "%E2%96%A0%E2%96%A0%E2%96%A0%E2%96%A0%E2%96%A0%E2%96%A0%E2%96%A0%E2%96%A0%E2%96%A0%E2%96%A0%E2%96%A1%2B";

const MOBILE = "8114491364";
const OTP = "123456";

const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

const USER = {
  symbolId: SECURE_ID_STR,
  fullName: "+91" + MOBILE,
  mobileNumber: "+91" + MOBILE,
  referralCount: 0,
  hasPin: true,
  hasPasskey: false,
};

const LINK_USER = { ...USER, symbolId: LINK_ID };

/** Is this resolve call asking about a symbol ID (rather than a number)? */
const identifierOf = (url) => decodeURIComponent(new URL(url).searchParams.get("identifier") || "");
const isMobileIdentifier = (identifier) => /^\+?\d+$/.test(identifier);

async function mockBackend(page, overrides = {}, user = USER) {
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
    if (url.includes("/api/register-symbol")) return route.fulfill(json({ user, referralApplied: true }, 201));
    if (url.includes("/api/pin/set")) return route.fulfill(json({ user }));
    if (url.includes("/api/login")) return route.fulfill(json({ user }));
    if (url.includes("/api/referrals/")) return route.fulfill(json({ referrals: [], total: 0 }));
    if (url.includes("/api/users/resolve")) {
      const identifier = identifierOf(url);
      return route.fulfill(isMobileIdentifier(identifier) ? json({ success: true, user }) : json({ user: null }, 404));
    }
    if (url.includes("/api/profile/")) return route.fulfill(json({ user }));
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

async function gotoDashboard(page, overrides, user = USER) {
  await mockBackend(page, overrides, user);
  await page.addInitScript((u) => {
    window.localStorage.setItem(
      "gloobal.session.v1",
      JSON.stringify({ user: u, phoneNumber: "8114491364", savedAt: Date.now() })
    );
  }, user);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toBeVisible({ timeout: 30_000 });
}

/** Dashboard -> Profile -> Change Gloobal ID. */
async function gotoChangeId(page, overrides, user = USER) {
  await gotoDashboard(page, overrides, user);
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "My Gloobal ID", exact: true }).click();
  await expect(page.getByRole("button", { name: "Update ID", exact: true })).toBeVisible({ timeout: 30_000 });
}

/** Dashboard -> Profile -> My Referral Network -> Share your Gloobal ID. */
async function gotoShareScreen(page, overrides, user = LINK_USER) {
  await gotoDashboard(page, overrides, user);
  await page.getByRole("button", { name: "Profile", exact: true }).click();
  await page.getByRole("button", { name: "My Network", exact: true }).click();
  await page.getByRole("button", { name: /Share your referral link/i }).click();
  await expect(page.getByText("Share your Gloobal ID", { exact: true })).toBeVisible({ timeout: 30_000 });
}

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

/** Registration path as far as the Gloobal ID creation step. */
async function gotoIdCreation(page, overrides) {
  await mockBackend(page, overrides);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /Phone number/i })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Phone number/i }).click();
  await tapDigits(page, MOBILE);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText(/VERIFY OTP/i)).toBeVisible({ timeout: 30_000 });
  await tapDigits(page, OTP);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
}

// ═══ BUG 1 — availability check ════════════════════════════════════════════

test("AV-A: A taken ID shows Already taken, never Available, and blocks Update", async ({ page }) => {
  await gotoChangeId(page, {
    "/api/users/resolve": (route) => {
      const identifier = identifierOf(route.request().url());
      if (isMobileIdentifier(identifier)) return json({ success: true, user: USER });
      return json({ success: true, user: { ...USER, symbolId: identifier } });
    },
  });

  await tapSymbols(page, OTHER_ID);

  await expect(page.getByTestId("new-id-taken")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("new-id-available")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Update ID", exact: true })).toBeDisabled();
});

test("AV-B: A free ID shows Available ✓ and enables Update", async ({ page }) => {
  await gotoChangeId(page);
  await tapSymbols(page, OTHER_ID);

  await expect(page.getByTestId("new-id-available")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("new-id-taken")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Update ID", exact: true })).toBeEnabled();
});

test("AV-C: No availability call fires before all 12 symbols are entered", async ({ page }) => {
  const checks = [];
  await gotoChangeId(page, {
    "/api/users/resolve": (route) => {
      const identifier = identifierOf(route.request().url());
      if (!isMobileIdentifier(identifier)) checks.push(identifier);
      return json({ user: null }, 404);
    },
  });

  await tapSymbols(page, OTHER_ID.slice(0, 6));

  expect(checks).toHaveLength(0);
  await expect(page.getByTestId("new-id-available")).toHaveCount(0);
  await expect(page.getByTestId("new-id-taken")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Update ID", exact: true })).toBeDisabled();
});

test("AV-D: Clearing the new ID hides the availability indicator", async ({ page }) => {
  await gotoChangeId(page);
  await tapSymbols(page, OTHER_ID);
  await expect(page.getByTestId("new-id-available")).toBeVisible({ timeout: 30_000 });

  const del = page.getByRole("button", { name: "Delete last symbol", exact: true });
  for (let i = 0; i < 12; i += 1) await del.click();

  await expect(page.getByTestId("new-id-available")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Update ID", exact: true })).toBeDisabled();
});

test("AV-E: Registration flags a taken ID rather than letting it through", async ({ page }) => {
  await gotoIdCreation(page, {
    "/api/users/resolve": (route) => {
      const identifier = identifierOf(route.request().url());
      if (isMobileIdentifier(identifier)) return json({ success: true, user: USER });
      return json({ success: true, user: { ...USER, symbolId: identifier } });
    },
  });

  await tapSymbols(page, SECURE_ID);

  await expect(page.getByText(/already taken/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "IN", exact: true })).toBeDisabled();
});

test("AV-F: Taken and free IDs are told apart in the same session", async ({ page }) => {
  await gotoChangeId(page, {
    "/api/users/resolve": (route) => {
      const identifier = identifierOf(route.request().url());
      if (isMobileIdentifier(identifier)) return json({ success: true, user: USER });
      // OTHER_ID is owned; anything else is free.
      if (identifier === OTHER_ID_STR) return json({ success: true, user: { ...USER, symbolId: identifier } });
      return json({ user: null }, 404);
    },
  });

  await tapSymbols(page, OTHER_ID);
  await expect(page.getByTestId("new-id-taken")).toBeVisible({ timeout: 30_000 });

  const del = page.getByRole("button", { name: "Delete last symbol", exact: true });
  for (let i = 0; i < 12; i += 1) await del.click();

  // A different, unowned ID — same screen, same session.
  await tapSymbols(page, Array.from({ length: 12 }, () => "●"));
  await expect(page.getByTestId("new-id-available")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("new-id-taken")).toHaveCount(0);
});

test("AV-G: A failed availability lookup never renders as Available", async ({ page }) => {
  // The actual reported bug. Every non-404 failure used to be swallowed into
  // `available: true`, which is precisely a green tick over a taken ID.
  await gotoChangeId(page, {
    "/api/users/resolve": (route) => {
      const identifier = identifierOf(route.request().url());
      if (isMobileIdentifier(identifier)) return json({ success: true, user: USER });
      return json({ message: "Server error." }, 500);
    },
  });

  await tapSymbols(page, OTHER_ID);

  await expect(page.getByTestId("new-id-unknown")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("new-id-available")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Update ID", exact: true })).toBeDisabled();
});

// ═══ BUG 2 — referral link ═════════════════════════════════════════════════

test("RL-A: Share link percent-encodes the Gloobal ID, + included", async ({ page }) => {
  await stubWebShare(page);
  await gotoShareScreen(page);

  await page.getByRole("button", { name: "Share", exact: true }).click();
  const payload = await page.evaluate(() => window.__sharePayloads[0]);

  expect(payload.url).toContain(LINK_ID_ENCODED);
  expect(payload.url).toContain("%2B");
  expect(payload.url).not.toMatch(/\+/);
  expect(payload.url).not.toContain("■");
  expect(payload.url).not.toContain("□");
});

test("RL-B: Copy button copies the encoded URL", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await gotoShareScreen(page);

  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(page.getByText(/Link copied/i).first()).toBeVisible({ timeout: 10_000 });

  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain(LINK_ID_ENCODED);
  expect(clipboard).not.toContain("■");
  expect(clipboard).not.toMatch(/\+/);
  // Points at a host that actually resolves and serves /r/:symbolId — the
  // hardcoded gloobal.id does not exist, which is why links stayed broken
  // after the encoding was fixed.
  expect(clipboard.startsWith("https://gloobal-pay.onrender.com/r/")).toBe(true);
});

test("RL-C: Share text carries raw symbols while the URL carries encoded ones", async ({ page }) => {
  await stubWebShare(page);
  await gotoShareScreen(page);

  await page.getByRole("button", { name: "Share", exact: true }).click();
  const payload = await page.evaluate(() => window.__sharePayloads[0]);

  expect(payload.text).toContain(LINK_ID);
  expect(payload.text).toContain(LINK_ID_ENCODED);
  expect(payload.url).toContain(LINK_ID_ENCODED);
});

test("RL-D: ?ref= pre-fills the referral step and marks it applied", async ({ page }) => {
  await mockBackend(page);
  await page.goto(`/?ref=${LINK_ID_ENCODED}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /Phone number/i })).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: /Phone number/i }).click();
  await tapDigits(page, MOBILE);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText(/VERIFY OTP/i)).toBeVisible({ timeout: 30_000 });
  await tapDigits(page, OTP);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
  await tapSymbols(page, SECURE_ID);
  await page.getByRole("button", { name: "IN", exact: true }).click();

  await expect(page.getByText("Referral applied", { exact: true })).toBeVisible({ timeout: 30_000 });
  const chips = page.getByLabel(/^\d+ of 12 entered$/);
  expect((await chips.innerText()).replace(/\s/g, "")).toBe(LINK_ID);
});

test("RL-E: A corrupted ?ref= value is ignored silently", async ({ page }) => {
  await mockBackend(page);
  // Truncated by a link preview — not 12 valid Gloobal symbols.
  await page.goto("/?ref=BADVALUE", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /Phone number/i })).toBeVisible({ timeout: 30_000 });

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

  // Empty, unlocked, and no complaint about the bad value.
  await expect(page.getByLabel("0 of 12 entered")).toBeVisible();
  await expect(page.getByText("Referral applied", { exact: true })).toHaveCount(0);
  await expect(page.getByTestId("referral-error")).toHaveCount(0);
});
