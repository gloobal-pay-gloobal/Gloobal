// Throwaway visual check: badge size + clearance above the Secure ID card.
import { test, expect } from "@playwright/test";

const BACKEND = "https://gloobal-pay.onrender.com";
const MOBILE = "8114491364";
const OTP = "123456";

const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });

const USER = {
  symbolId: "−+×=○□●■−+×=",
  fullName: "Priya Sharma",
  mobileNumber: "+91" + MOBILE,
  referralCount: 0,
  hasPin: true,
  hasPasskey: false,
  cashbackRate: 0,
  symbolIdHistory: [],
  balance: 5000,
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
    if (url.includes("/api/otp/send")) return route.fulfill(json({ message: "ok" }));
    if (url.includes("/api/otp/verify")) return route.fulfill(json({ verified: true }));
    if (url.includes("/api/users/resolve")) return route.fulfill(json({ success: true, user: USER }));
    if (url.includes("/api/profile/")) return route.fulfill(json({ user: USER }));
    if (url.includes("/api/passkey/")) return route.fulfill(json({ hasPasskey: false }));
    return route.fulfill(json({}));
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
}

const tapDigits = async (page, digits) => {
  for (const d of digits) await page.getByRole("button", { name: `Digit ${d}`, exact: true }).first().click();
};

async function report(page, tag) {
  const geom = await page.getByTestId("secureid-badge").evaluate((el) => {
    const s = getComputedStyle(el);
    const b = el.getBoundingClientRect();
    const card = el.parentElement.getBoundingClientRect();
    return {
      text: el.textContent.trim(),
      fontSize: s.fontSize,
      badge: { x: b.x, y: b.y, w: b.width, h: b.height },
      cardTop: card.top,
      gapAboveCard: card.top - b.bottom,
      offTopOfViewport: b.top < 0,
    };
  });
  console.log("BADGE " + tag + ": " + JSON.stringify(geom, null, 2));
  await page.screenshot({ path: `verify-shots/badge-${tag}.png` });
}

test.use({ viewport: { width: 390, height: 844 } });

test("register badge geometry", async ({ page }) => {
  await mockBackend(page, { "/api/users/resolve": () => json({ user: null }, 404) });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Phone number/i }).click();
  await tapDigits(page, MOBILE);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText(/VERIFY OTP/i)).toBeVisible({ timeout: 30_000 });
  await tapDigits(page, OTP);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
  await report(page, "register");
});

test("login badge geometry", async ({ page }) => {
  await mockBackend(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Flip to log in/i }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
  await report(page, "login");
});
