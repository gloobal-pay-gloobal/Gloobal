// Verification of the 6 founder UI fixes, screen by screen.
//
// Unlike gloobal.spec.mjs (which drives the real Render backend end to
// end), this suite stubs every /api/ call. These are assertions about
// layout, type scale, labels and back-navigation — none of that needs a
// real account, and mocking keeps the run fast, deterministic, and free
// of junk registrations against the live database.
import { test, expect } from "@playwright/test";

const SYMBOL_ALPHABET = ["−", "+", "×", "=", "○", "□", "●", "■"];
const OTP = "123456";
const PIN = "123456";
const MOBILE = "9876543210";
const SECURE_ID = Array.from({ length: 12 }, (_, i) => SYMBOL_ALPHABET[i % SYMBOL_ALPHABET.length]);

const json = (body, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(body),
});

const FAKE_USER = {
  symbolId: SECURE_ID.join(""),
  fullName: "+91" + MOBILE,
  mobileNumber: "+91" + MOBILE,
  referralCount: 0,
  hasPin: true,
  hasPasskey: false,
};

// Every stub is scoped to the backend's own origin. A broader glob like
// "**/api/**" also matches the app's own module URL
// /src/services/api/authApi.js under Vite — fulfilling that with JSON
// breaks the module graph and the app never mounts past its splash.
const BACKEND = "https://gloobal-pay.onrender.com";

/** Stubs the whole backend surface these screens can touch. */
async function mockBackend(page) {
  await page.route(`${BACKEND}/**`, async (route) => {
    const url = route.request().url();
    if (url.includes("/api/otp/send")) return route.fulfill(json({ message: "sent" }));
    if (url.includes("/api/otp/verify")) return route.fulfill(json({ verified: true }));
    if (url.includes("/api/register-symbol")) return route.fulfill(json({ user: FAKE_USER }, 201));
    if (url.includes("/api/pin/set")) return route.fulfill(json({ user: FAKE_USER }));
    if (url.includes("/api/login")) return route.fulfill(json({ user: FAKE_USER }));
    if (url.includes("/api/users/resolve")) return route.fulfill(json({ success: true, user: FAKE_USER }));
    if (url.includes("/api/profile/")) return route.fulfill(json({ user: FAKE_USER }));
    if (url.includes("/api/transactions/history/"))
      return route.fulfill(json({ success: true, transactions: [], count: 0 }));
    if (url.includes("/api/passkey/")) return route.fulfill(json({ hasPasskey: false }));
    return route.fulfill(json({}));
  });
  // The dial-pad flip animation and the ambient particle field both animate
  // continuously; freezing them keeps geometry assertions stable.
  await page.emulateMedia({ reducedMotion: "reduce" });
}

const tapDigits = async (page, digits) => {
  for (const d of digits) await page.getByRole("button", { name: `Digit ${d}`, exact: true }).first().click();
};

const tapSymbols = async (page, symbols) => {
  for (const s of symbols) await page.getByRole("button", { name: `Symbol ${s}`, exact: true }).click();
};

/** px number from a computed style string like "28px". */
const px = (v) => parseFloat(String(v).replace("px", ""));

const computed = (locator, prop) =>
  locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

/** Landing (stage "phone"). */
async function gotoHome(page) {
  await mockBackend(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /Phone number/i })).toBeVisible({ timeout: 30_000 });
}

/** Landing -> OTP -> Secure ID creation (registration path). */
async function gotoSecureIdCreation(page) {
  await gotoHome(page);
  await page.getByRole("button", { name: /Phone number/i }).click();
  await tapDigits(page, MOBILE);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText(/VERIFY OTP/i)).toBeVisible({ timeout: 30_000 });
  await tapDigits(page, OTP);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
}

/** ...on to the Referral step. */
async function gotoReferral(page) {
  await gotoSecureIdCreation(page);
  await tapSymbols(page, SECURE_ID);
  await page.getByRole("button", { name: "IN", exact: true }).click();
  await expect(page.getByRole("button", { name: /Skip for now/i })).toBeVisible({ timeout: 30_000 });
}

/** ...on to the one-time device-security setup screen. */
async function gotoDeviceSetup(page) {
  await gotoReferral(page);
  await page.getByRole("button", { name: /Skip for now/i }).click();
  await expect(page.getByText("0/6")).toBeVisible({ timeout: 30_000 });
  await tapDigits(page, PIN);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText(/Set up device security/i)).toBeVisible({ timeout: 30_000 });
}

/** Landing -> flip to login -> Secure ID -> PIN entry (stage "loginAuth"). */
async function gotoLoginAuth(page) {
  await gotoHome(page);
  await page.getByRole("button", { name: /Flip to log in/i }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
  await tapSymbols(page, SECURE_ID);
  await page.getByRole("button", { name: "Log in", exact: true }).last().click();
  await expect(page.getByText(/Verify it's you/i)).toBeVisible({ timeout: 30_000 });
}

test.describe("Screen 1 — landing", () => {
  test("1a: logo sits inside a visible bordered box", async ({ page }) => {
    await gotoHome(page);
    const logo = page.getByAltText("Gloobal ID");
    await expect(logo).toBeVisible();

    const box = logo.locator("xpath=..");
    expect(px(await computed(box, "border-top-width"))).toBeGreaterThan(0);
    expect(px(await computed(box, "border-top-left-radius"))).toBeGreaterThan(0);
    // Opaque surface, not a see-through wrapper.
    const bg = await computed(box, "background-color");
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(await computed(box, "box-shadow")).not.toBe("none");
    // The box has to be visibly larger than the image it contains.
    const logoBox = await logo.boundingBox();
    const boxBox = await box.boundingBox();
    expect(boxBox.width).toBeGreaterThan(logoBox.width);
  });

  test("1b: 'Gloobal ID' heading is a prominent primary heading", async ({ page }) => {
    await gotoHome(page);
    const heading = page.getByText("Gloobal ID", { exact: true }).first();
    await expect(heading).toBeVisible();
    const size = px(await computed(heading, "font-size"));
    // Was 22px before the fix; a primary heading should clear 26px.
    expect(size).toBeGreaterThanOrEqual(26);
    expect(px(await computed(heading, "font-weight"))).toBeGreaterThanOrEqual(700);
  });

  test("1c: phone field matches the ID-entry field's styling exactly", async ({ page }) => {
    await gotoHome(page);
    const homeField = page.getByRole("button", { name: /Phone number/i });
    const homeStyle = {
      bg: await computed(homeField, "background-color"),
      radius: await computed(homeField, "border-top-left-radius"),
      padding: await computed(homeField, "padding-left"),
      borderWidth: await computed(homeField, "border-top-width"),
    };

    // The comparable field on the ID screen is the login card's mobile
    // input (the creation face itself uses symbol chips, not a text box).
    await page.getByRole("button", { name: /Flip to log in/i }).click();
    await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /Switch to mobile number/i }).click();

    const idField = page.getByText("Mobile number", { exact: true }).locator("xpath=..");
    await expect(idField).toBeVisible();

    expect(await computed(idField, "background-color")).toBe(homeStyle.bg);
    expect(await computed(idField, "border-top-left-radius")).toBe(homeStyle.radius);
    expect(await computed(idField, "padding-left")).toBe(homeStyle.padding);
    expect(await computed(idField, "border-top-width")).toBe(homeStyle.borderWidth);
  });
});

test.describe("Screen 5 — Gloobal ID creation", () => {
  test("5a: carries the 'Gloobal ID' heading at the same scale as the landing page", async ({ page }) => {
    await gotoSecureIdCreation(page);
    const heading = page.getByText("Gloobal ID", { exact: true }).first();
    await expect(heading).toBeVisible();
    expect(px(await computed(heading, "font-size"))).toBeGreaterThanOrEqual(26);
  });

  test("5b: back navigates to the OTP step", async ({ page }) => {
    await gotoSecureIdCreation(page);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByText(/VERIFY OTP/i)).toBeVisible({ timeout: 30_000 });
  });

  test("2d: the submit control reads 'IN', not 'Submit'", async ({ page }) => {
    await gotoSecureIdCreation(page);
    await expect(page.getByRole("button", { name: "IN", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit", exact: true })).toHaveCount(0);
  });

  test("2b: the info icon sits in the screen's top-right corner", async ({ page }) => {
    await gotoSecureIdCreation(page);
    const info = page.getByRole("button", { name: /What is a Gloobal ID/i });
    await expect(info).toBeVisible();

    const viewport = page.viewportSize();
    const b = await info.boundingBox();
    // Right half of the screen, hard against the top.
    expect(b.x).toBeGreaterThan(viewport.width / 2);
    expect(b.x + b.width).toBeLessThanOrEqual(viewport.width);
    expect(b.y).toBeLessThan(100);
  });

  test("2c: the dial's brand mark is a restrained watermark", async ({ page }) => {
    await gotoSecureIdCreation(page);
    // The flip coin's back face carries the mark; it is in the DOM even
    // while the dial face is showing.
    const mark = page.locator('img[aria-hidden="true"]').first();
    const width = await mark.evaluate((el) => el.getBoundingClientRect().width || parseFloat(el.style.width));
    // housingSize is 222px: the old 0.74 factor gave ~164px, the new 0.40
    // gives ~89px. Assert it landed nearer the latter.
    expect(width).toBeLessThan(110);
    expect(width).toBeGreaterThan(60);
  });
});

test.describe("Screen 3 — Referral", () => {
  test("3b: shows the 'Gloobal ID' heading", async ({ page }) => {
    await gotoReferral(page);
    const heading = page.getByText("Gloobal ID", { exact: true }).first();
    await expect(heading).toBeVisible();
    expect(px(await computed(heading, "font-size"))).toBeGreaterThanOrEqual(26);
  });

  test("3a: back navigates to the Gloobal ID creation screen", async ({ page }) => {
    await gotoReferral(page);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    // Both stages render a SymbolDialPad and an "IN" button, so neither is
    // a usable landmark for "we left the referral step" — they are on
    // screen throughout the outgoing flip. The card's REFERRAL ID badge
    // disappearing is the signal that the stage actually changed.
    await expect(page.getByText("Referral ID", { exact: true })).toBeHidden({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /Skip for now/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "IN", exact: true })).toBeVisible();
  });

  test("3c: the info icon sits in the screen's top-right corner", async ({ page }) => {
    await gotoReferral(page);
    const info = page.getByRole("button", { name: /What is a referral/i });
    await expect(info).toBeVisible();
    const viewport = page.viewportSize();
    const b = await info.boundingBox();
    expect(b.x).toBeGreaterThan(viewport.width / 2);
    expect(b.y).toBeLessThan(100);
  });

  test("3d: the submit control reads 'IN'", async ({ page }) => {
    await gotoReferral(page);
    await expect(page.getByRole("button", { name: "IN", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Submit", exact: true })).toHaveCount(0);
  });
});

test.describe("Screen 4 — device security setup", () => {
  test("4a: Face ID and Fingerprint icons are large", async ({ page }) => {
    await gotoDeviceSetup(page);

    for (const name of [/Verify with Face ID/i, /Verify with fingerprint/i]) {
      const circle = page.getByRole("button", { name }).locator("span").first();
      await expect(circle).toBeVisible();
      const b = await circle.boundingBox();
      // Requirement was "at least 64px"; the implementation uses 88.
      expect(b.width).toBeGreaterThanOrEqual(64);
      expect(b.height).toBeGreaterThanOrEqual(64);
      // Still an SVG glyph inside, still centred.
      await expect(page.getByRole("button", { name }).locator("svg")).toBeVisible();
    }
  });

  test("4a: the login screen keeps its original, smaller icons", async ({ page }) => {
    await gotoLoginAuth(page);
    const circle = page.getByRole("button", { name: /Verify with Face ID/i }).locator("span").first();
    const b = await circle.boundingBox();
    // Scoped change: only the setup screen grew.
    expect(b.width).toBeLessThan(64);
  });
});

test.describe("Screen 6 — PIN entry", () => {
  test("6a: shows the 'Gloobal ID' label", async ({ page }) => {
    await gotoLoginAuth(page);
    const heading = page.getByText("Gloobal ID", { exact: true }).first();
    await expect(heading).toBeVisible();
    expect(px(await computed(heading, "font-size"))).toBeGreaterThanOrEqual(20);
  });
});
