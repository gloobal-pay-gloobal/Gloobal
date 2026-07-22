// Verification for the three founder features:
//
//   F1 — the login country code is locked to the country the number is
//        actually registered under, so the same digits can't be replayed
//        behind a different flag.
//   F2 — a taken Gloobal ID offers two tappable suggestions instead of a
//        dead-end error.
//   F3 — the login screen shows when this Gloobal ID last signed in.
//
// Every backend call is stubbed, scoped strictly to the API origin. A
// broader glob like "**/api/**" also matches the app's own Vite module URL
// /src/services/api/authApi.js, which breaks the module graph and the app
// never mounts.
import { test, expect } from "@playwright/test";

const BACKEND = "https://gloobal-pay.onrender.com";
const SYMBOL_ALPHABET = ["−", "+", "×", "=", "○", "□", "●", "■"];
const SECURE_ID = Array.from({ length: 12 }, (_, i) => SYMBOL_ALPHABET[i % SYMBOL_ALPHABET.length]);
const SECURE_ID_STR = SECURE_ID.join("");
const OTP = "123456";
const MOBILE = "8114491364";

const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

const USER = (over = {}) => ({
  symbolId: SECURE_ID_STR,
  fullName: "Feature Test",
  mobileNumber: "+91" + MOBILE,
  referralCount: 0,
  hasPin: true,
  hasPasskey: false,
  ...over,
});

/**
 * Stubs the backend. `handlers` overrides individual endpoints; anything
 * not overridden gets a sane default. Returns a counter object so tests can
 * assert how many times an endpoint was actually hit.
 */
async function mockBackend(page, handlers = {}) {
  const calls = { resolve: 0, profile: 0 };
  await page.route(`${BACKEND}/**`, (route) => {
    const url = route.request().url();
    if (url.includes("/api/otp/send")) return route.fulfill(json({ message: "sent" }));
    if (url.includes("/api/otp/verify")) return route.fulfill(json({ verified: true }));
    if (url.includes("/api/register-symbol")) return route.fulfill(json({ user: USER() }, 201));
    if (url.includes("/api/pin/set")) return route.fulfill(json({ user: USER() }));
    if (url.includes("/api/login")) return route.fulfill(json({ user: USER() }));
    if (url.includes("/api/users/resolve")) {
      calls.resolve += 1;
      return route.fulfill(handlers.resolve ? handlers.resolve(calls.resolve, url) : json({ user: null }, 404));
    }
    if (url.includes("/api/profile/")) {
      calls.profile += 1;
      return route.fulfill(handlers.profile ? handlers.profile(calls.profile, url) : json({ user: USER() }));
    }
    if (url.includes("/api/passkey/")) return route.fulfill(json({ hasPasskey: false }));
    return route.fulfill(json({}));
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  return calls;
}

const tapDigits = async (page, digits) => {
  for (const d of digits) await page.getByRole("button", { name: `Digit ${d}`, exact: true }).first().click();
};

const tapSymbols = async (page, symbols) => {
  for (const s of symbols) await page.getByRole("button", { name: `Symbol ${s}`, exact: true }).click();
};

async function gotoHome(page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /Phone number/i })).toBeVisible({ timeout: 30_000 });
}

/** Landing -> login card, Gloobal ID face. */
async function gotoLoginId(page) {
  await gotoHome(page);
  await page.getByRole("button", { name: /Flip to log in/i }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
}

/** Landing -> login card, mobile-number face. */
async function gotoLoginMobile(page) {
  await gotoLoginId(page);
  await page.getByRole("button", { name: /Switch to mobile number/i }).click();
  await expect(page.getByText("Mobile number", { exact: true })).toBeVisible({ timeout: 30_000 });
}

/** Swaps the login card's country via the full-screen picker. */
async function pickLoginCountry(page, name) {
  await page.getByRole("button", { name: /^Country: /i }).click();
  await page.getByPlaceholder("Search country or code").fill(name);
  await page.getByRole("button", { name: new RegExp(`^${name}`, "i") }).first().click();
}

/** Landing -> OTP -> the Gloobal ID creation step (registration). */
async function gotoIdCreation(page) {
  await gotoHome(page);
  await page.getByRole("button", { name: /Phone number/i }).click();
  await tapDigits(page, MOBILE);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText(/VERIFY OTP/i)).toBeVisible({ timeout: 30_000 });
  await tapDigits(page, OTP);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
}

const lockIcon = (page) => page.getByTestId("country-lock");
const suggestionsPanel = (page) => page.getByTestId("id-suggestions");
const lastLoginBar = (page) => page.getByTestId("last-login-bar");

// ---------------------------------------------------------------------------
// FEATURE 1 — country lock
// ---------------------------------------------------------------------------

test.describe("F1 — login country code is locked to the registered number", () => {
  test("F1-A: CountryPicker is unlocked before phone number is entered", async ({ page }) => {
    await mockBackend(page);
    await gotoLoginMobile(page);

    const chip = page.getByRole("button", { name: /^Country: /i });
    await expect(chip).toBeVisible();
    await expect(chip).toBeEnabled();
    await expect(lockIcon(page)).toHaveCount(0);
  });

  test("F1-B: CountryPicker locks after phone number is resolved to a registered account", async ({ page }) => {
    await mockBackend(page, { resolve: () => json({ user: USER({ mobileNumber: "+91" + MOBILE }) }) });
    await gotoLoginMobile(page);
    await tapDigits(page, MOBILE);

    await expect(lockIcon(page)).toBeVisible({ timeout: 30_000 });
    const chip = page.getByRole("button", { name: /^Country locked to /i });
    await expect(chip).toBeDisabled();
    // Belt and braces: the chip is also inert to pointer input.
    expect(await chip.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe("none");
  });

  test("F1-C: Error shown if phone number not found for selected country", async ({ page }) => {
    // Nobody is registered under +44 with these digits.
    await mockBackend(page, { resolve: () => json({ user: null }, 404) });
    await gotoLoginMobile(page);
    await pickLoginCountry(page, "United Kingdom");
    await tapDigits(page, MOBILE);

    await expect(page.getByText("No account found for this number. Check your country code.")).toBeVisible({
      timeout: 30_000,
    });
    // A failed lookup must not lock the picker — that is the control the
    // person needs in order to correct the mistake.
    await expect(lockIcon(page)).toHaveCount(0);
  });

  test("F1-D: Login does not proceed if country code mismatches registered number", async ({ page }) => {
    // The account exists, but its stored number is Indian: the same digits
    // behind a UK flag must not get in.
    await mockBackend(page, { resolve: () => json({ user: USER({ mobileNumber: "+91" + MOBILE }) }) });
    await gotoLoginMobile(page);
    await pickLoginCountry(page, "United Kingdom");
    await tapDigits(page, MOBILE);

    await expect(page.getByText("No account found for this number. Check your country code.")).toBeVisible({
      timeout: 30_000,
    });

    // Tap IN anyway.
    await page.getByRole("button", { name: "Log in", exact: true }).click();
    await page.waitForTimeout(1500);

    // Still on the login card's mobile face, never on the PIN step. (The
    // "Mobile number" placeholder is no longer a usable landmark here —
    // typed digits replace it — so the card's own flip control is.)
    await expect(page.getByText(/Verify it's you/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Switch to Gloobal ID/i })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete last digit", exact: true })).toBeVisible();
    await expect(page.getByText("No account found for this number. Check your country code.")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// FEATURE 2 — Gloobal ID suggestions
// ---------------------------------------------------------------------------

test.describe("F2 — suggestions when a Gloobal ID is taken", () => {
  test("F2-A: Suggestions panel is hidden when ID is available", async ({ page }) => {
    await mockBackend(page, { resolve: () => json({ user: null }, 404) });
    await gotoIdCreation(page);
    await tapSymbols(page, SECURE_ID);

    await expect(page.getByRole("button", { name: "IN", exact: true })).toBeEnabled({ timeout: 30_000 });
    await expect(page.getByText("Suggested IDs")).toHaveCount(0);
    await expect(suggestionsPanel(page)).toHaveCount(0);
  });

  test("F2-B: Suggestions panel appears with 2 pills when ID is taken", async ({ page }) => {
    await mockBackend(page, { resolve: () => json({ user: USER() }) });
    await gotoIdCreation(page);
    await tapSymbols(page, SECURE_ID);

    await expect(page.getByText("Suggested IDs")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("That Gloobal ID is already taken.")).toBeVisible();

    const pills = suggestionsPanel(page).getByRole("button");
    await expect(pills).toHaveCount(2);

    const texts = await pills.allInnerTexts();
    expect(texts[0]).not.toBe(texts[1]);
    expect(texts).not.toContain(SECURE_ID_STR);
    for (const t of texts) expect(t.length).toBe(12);
  });

  test("F2-C: Tapping a suggestion fills the input and re-runs availability check", async ({ page }) => {
    // First lookup (the typed ID) says taken; the next one (the suggestion)
    // says free.
    const calls = await mockBackend(page, {
      resolve: (n) => (n === 1 ? json({ user: USER() }) : json({ user: null }, 404)),
    });
    await gotoIdCreation(page);
    await tapSymbols(page, SECURE_ID);
    await expect(suggestionsPanel(page)).toBeVisible({ timeout: 30_000 });
    expect(calls.resolve).toBe(1);

    const firstPill = suggestionsPanel(page).getByRole("button").first();
    const suggestion = (await firstPill.innerText()).trim();
    await firstPill.click();

    // The panel goes away, because the suggestion is available.
    await expect(suggestionsPanel(page)).toHaveCount(0, { timeout: 30_000 });
    // ...and that took a second availability check.
    expect(calls.resolve).toBe(2);

    // The entry card now holds the suggestion. Unmask it to read it back.
    await page.getByRole("button", { name: /Show Secure ID/i }).click();
    const chips = page.locator('[aria-label$="of 12 entered"]').first();
    const shown = (await chips.innerText()).replace(/\s+/g, "");
    expect(shown).toBe(suggestion);

    await expect(page.getByRole("button", { name: "IN", exact: true })).toBeEnabled();
  });

  test("F2-D: Suggestions panel disappears when user starts typing a new ID", async ({ page }) => {
    await mockBackend(page, { resolve: () => json({ user: USER() }) });
    await gotoIdCreation(page);
    await tapSymbols(page, SECURE_ID);
    await expect(suggestionsPanel(page)).toBeVisible({ timeout: 30_000 });

    // Editing the ID at all invalidates the "taken" verdict.
    await page.getByRole("button", { name: "Delete last symbol", exact: true }).click();

    await expect(suggestionsPanel(page)).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByText("Suggested IDs")).toHaveCount(0);
    await expect(page.getByText("That Gloobal ID is already taken.")).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// FEATURE 3 — last login bar
// ---------------------------------------------------------------------------

const LAST_LOGIN_ISO = "2026-07-22T07:49:00.000Z";

/** The same string the app builds, computed in the browser so the
 * assertion holds in any timezone the suite happens to run in. */
const expectedStamp = (page, iso) =>
  page.evaluate((v) => {
    const d = new Date(v);
    const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return `${date}, ${time}`;
  }, iso);

test.describe("F3 — last login info on the login screen", () => {
  test("F3-A: Last login bar is hidden before any ID is entered on login screen", async ({ page }) => {
    await mockBackend(page);
    await gotoLoginId(page);

    await expect(lastLoginBar(page)).toHaveCount(0);
    await expect(page.getByText(/Last login/i)).toHaveCount(0);
    await expect(page.getByText(/First time logging in/i)).toHaveCount(0);
  });

  test('F3-B: Last login bar shows "First time logging in" when no prior login stored', async ({ page }) => {
    await mockBackend(page, { profile: () => json({ user: USER() }) });
    await gotoHome(page);
    await page.evaluate(() => {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("gloobal.lastLogin."))
        .forEach((k) => localStorage.removeItem(k));
    });

    await page.getByRole("button", { name: /Flip to log in/i }).click();
    await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
    await tapSymbols(page, SECURE_ID);

    await expect(lastLoginBar(page)).toBeVisible({ timeout: 30_000 });
    await expect(lastLoginBar(page)).toContainText("First time logging in");
  });

  test("F3-C: Last login bar shows correct timestamp from localStorage on repeat login", async ({ page }) => {
    // Profile deliberately carries no last-login field, so the only source
    // left is what this device recorded.
    await mockBackend(page, { profile: () => json({ user: USER() }) });
    await gotoHome(page);
    await page.evaluate(
      ([id, iso]) => localStorage.setItem(`gloobal.lastLogin.${id}`, iso),
      [SECURE_ID_STR, LAST_LOGIN_ISO]
    );

    await page.getByRole("button", { name: /Flip to log in/i }).click();
    await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
    await tapSymbols(page, SECURE_ID);

    const stamp = await expectedStamp(page, LAST_LOGIN_ISO);
    await expect(lastLoginBar(page)).toBeVisible({ timeout: 30_000 });
    await expect(lastLoginBar(page)).toContainText(`Last login: ${stamp}`);
    // Sanity-check the format itself rather than only round-tripping our
    // own formatter.
    expect(stamp).toMatch(/^\d{2} \w{3} \d{4}, \d{1,2}:\d{2} (AM|PM)$/);
  });

  test("F3-C2: Last login bar shows timestamp from profile API if returned", async ({ page }) => {
    await mockBackend(page, { profile: () => json({ user: USER({ lastLoginAt: LAST_LOGIN_ISO }) }) });
    await gotoHome(page);
    // A *different*, older value in storage — the API answer must win.
    await page.evaluate(
      ([id]) => localStorage.setItem(`gloobal.lastLogin.${id}`, "2020-01-01T00:00:00.000Z"),
      [SECURE_ID_STR]
    );

    await page.getByRole("button", { name: /Flip to log in/i }).click();
    await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
    await tapSymbols(page, SECURE_ID);

    const stamp = await expectedStamp(page, LAST_LOGIN_ISO);
    await expect(lastLoginBar(page)).toBeVisible({ timeout: 30_000 });
    await expect(lastLoginBar(page)).toContainText(`Last login: ${stamp}`);
    await expect(lastLoginBar(page)).not.toContainText("2020");
  });

  test("F3-D: Last login bar disappears when ID input is cleared", async ({ page }) => {
    await mockBackend(page, { profile: () => json({ user: USER() }) });
    await gotoLoginId(page);
    await tapSymbols(page, SECURE_ID);
    await expect(lastLoginBar(page)).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Delete last symbol", exact: true }).click();

    await expect(lastLoginBar(page)).toHaveCount(0, { timeout: 30_000 });
  });
});
