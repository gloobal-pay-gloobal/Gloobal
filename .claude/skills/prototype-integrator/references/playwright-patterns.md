# Playwright patterns

Conventions taken from the existing suite in `Frontend/e2e/`. Match them — a new spec that invents its own style is harder to keep green than one that copies `session-persistence.spec.mjs`.

## Config facts

`Frontend/playwright.config.mjs`:

- `testDir: "./e2e"`, `testMatch: "**/*.spec.mjs"` — **`.mjs`, not `.ts`**
- `fullyParallel: false`, `workers: 1` — specs run single-file
- `timeout: 240_000`, `expect.timeout: 30_000` — generous, because the real backend cold-starts
- `baseURL: "http://localhost:5199"` — `page.goto("/")`, never a hardcoded host
- `viewport: { width: 420, height: 900 }` — mobile portrait; assume a phone layout
- `webServer` runs `npx vite --port 5199 --strictPort` with `reuseExistingServer: true`

Run:

```bash
cd "D:/Gloobal project/Frontend"
npx playwright test                              # all
npx playwright test e2e/your-feature.spec.mjs    # one
npx playwright test --headed                     # watch it
```

## Mock the backend

New specs should mock, not hit Render. Deterministic and fast.

```js
import { test, expect } from "@playwright/test";

const BACKEND = "https://gloobal-pay.onrender.com";
const json = (b, s = 200) => ({ status: s, contentType: "application/json", body: JSON.stringify(b) });

const USER = {
  symbolId: SECURE_ID.join(""),
  fullName: "Session Test",
  mobileNumber: "+91" + MOBILE,
  referralCount: 2,
  hasPin: true,
  hasPasskey: false,
};

async function mockBackend(page) {
  await page.route(`${BACKEND}/**`, (r) => {
    const u = r.request().url();
    if (u.includes("/api/otp/send")) return r.fulfill(json({ message: "sent" }));
    if (u.includes("/api/otp/verify")) return r.fulfill(json({ verified: true }));
    if (u.includes("/api/register-symbol")) return r.fulfill(json({ user: USER }, 201));
    if (u.includes("/api/pin/set")) return r.fulfill(json({ user: USER }));
    if (u.includes("/api/login")) return r.fulfill(json({ user: USER }));
    if (u.includes("/api/pin/verify")) return r.fulfill(json({ verified: true }));
    if (u.includes("/api/profile/")) return r.fulfill(json({ user: USER }));
    if (u.includes("/api/transactions/history/")) return r.fulfill(json({ success: true, transactions: [], count: 0 }));
    return r.fulfill(json({}));                    // catch-all, so nothing escapes to the network
  });
}
```

Keep the catch-all last. Without it an unmocked call silently hits the real backend.

Response shapes must match what `services/api/*` actually reads — `{ user }`, `{ verified }`, `{ transactions }`. A mock returning the wrong shape produces a green test over broken code.

## Test fixtures

```js
const SYMBOLS = ["−", "+", "×", "=", "○", "□", "●", "■"];
const SECURE_ID = Array.from({ length: 12 }, (_, i) => SYMBOLS[i % SYMBOLS.length]);
const MOBILE = "9876543210";
const OTP = "123456";
const PIN = "123456";
```

A Secure ID is 12 symbols, not text. Note `−` is U+2212 (minus), not a hyphen.

## Input helpers

Everything is driven through accessible names, not CSS selectors:

```js
const digits = async (page, d) => {
  for (const x of d) await page.getByRole("button", { name: `Digit ${x}`, exact: true }).first().click();
};
const syms = async (page, s) => {
  for (const x of s) await page.getByRole("button", { name: `Symbol ${x}`, exact: true }).click();
};
```

If a new screen needs a helper like these, its buttons need `aria-label`s in the same `Digit N` / `Symbol X` style.

## Walking the registration flow

```js
async function registerToDashboard(page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Phone number/i }).click();
  await digits(page, MOBILE);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText(/VERIFY OTP/i)).toBeVisible({ timeout: 30_000 });
  await digits(page, OTP);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("button", { name: "Symbol −", exact: true })).toBeVisible({ timeout: 30_000 });
  await syms(page, SECURE_ID);
  await page.getByRole("button", { name: "IN", exact: true }).click();
  await expect(page.getByRole("button", { name: /Skip for now/i })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Skip for now/i }).click();      // referral
  await expect(page.getByText("0/6")).toBeVisible({ timeout: 30_000 });
  await digits(page, PIN);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByText(/Set up device security/i)).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: /Skip for now/i }).click();      // biometric
  await expect(page.getByRole("button", { name: "Profile", exact: true })).toBeVisible({ timeout: 30_000 });
}
```

If a feature sits behind login, reuse this rather than re-deriving the flow. `"Profile"` being visible is the standard "we're on the dashboard" assertion.

## House rules

- **Locators**: `getByRole` with an accessible name, or `getByText`. Avoid CSS/XPath.
- **Assertions**: always `await expect(...)`, always an explicit `{ timeout: 30_000 }` on anything post-navigation.
- **File header**: every existing spec opens with a comment saying what regression it covers and, if behaviour changed, a dated note explaining the change. Do the same.
- **Naming**: `<feature>.spec.mjs` for feature coverage; the `fix-verification-DDMM` pattern is for dated fix batches.
- **Don't weaken existing specs** to make a new integration pass. If a prototype breaks `session-persistence.spec.mjs`, the prototype is wrong.

## Regression gate

Before handoff: full suite, and no spec may go green → red.

```bash
npx playwright test
```

`trace: "retain-on-failure"` is on — `npx playwright show-trace` on a failure instead of guessing.
