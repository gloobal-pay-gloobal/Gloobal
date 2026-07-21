// Full-application walkthrough: drives every screen in the onboarding and
// login flows, measures each of the 6 founder fixes against the live DOM,
// and writes a screenshot per screen. Reports measured values, not just
// pass/fail, so the numbers can be eyeballed independently.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const OUT = "verify-shots";
mkdirSync(OUT, { recursive: true });

const BACKEND = "https://gloobal-pay.onrender.com";
const SYMBOLS = ["−", "+", "×", "=", "○", "□", "●", "■"];
const SECURE_ID = Array.from({ length: 12 }, (_, i) => SYMBOLS[i % SYMBOLS.length]);
const MOBILE = "9876543210";
const OTP = "123456";
const PIN = "123456";

const json = (b, s = 200) => ({ status: s, contentType: "application/json", body: JSON.stringify(b) });
const USER = {
  symbolId: SECURE_ID.join(""),
  fullName: "+91" + MOBILE,
  mobileNumber: "+91" + MOBILE,
  referralCount: 0,
  hasPin: true,
  hasPasskey: false,
};

const results = [];
const check = (fix, screen, desc, pass, detail) => {
  results.push({ fix, screen, desc, pass, detail });
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${fix.padEnd(4)} ${desc} — ${detail}`);
};

const css = (loc, prop) => loc.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);
const px = (v) => parseFloat(String(v).replace("px", ""));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });

const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error" && !m.text().includes("frame-ancestors") && !m.text().includes("Failed to load resource"))
    pageErrors.push(m.text());
});

await page.route(`${BACKEND}/**`, (r) => {
  const u = r.request().url();
  if (u.includes("/api/otp/send")) return r.fulfill(json({ message: "sent" }));
  if (u.includes("/api/otp/verify")) return r.fulfill(json({ verified: true }));
  if (u.includes("/api/register-symbol")) return r.fulfill(json({ user: USER }, 201));
  if (u.includes("/api/pin/set")) return r.fulfill(json({ user: USER }));
  if (u.includes("/api/login")) return r.fulfill(json({ user: USER }));
  if (u.includes("/api/users/resolve")) return r.fulfill(json({ success: true, user: USER }));
  if (u.includes("/api/profile/")) return r.fulfill(json({ user: USER }));
  if (u.includes("/api/transactions/history/")) return r.fulfill(json({ success: true, transactions: [], count: 0 }));
  return r.fulfill(json({}));
});

const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`    [shot] ${OUT}/${name}.png`);
};
const digits = async (d) => {
  for (const x of d) await page.getByRole("button", { name: `Digit ${x}`, exact: true }).first().click();
};
const syms = async (s) => {
  for (const x of s) await page.getByRole("button", { name: `Symbol ${x}`, exact: true }).click();
};

// ── SCREEN 1: landing ───────────────────────────────────────────────────
console.log("\n== SCREEN 1: landing (stage 'phone') ==");
await page.goto("http://localhost:5199/", { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: /Phone number/i }).waitFor({ timeout: 30000 });
await shot("01-landing");

const logo = page.getByAltText("Gloobal ID");
const box = logo.locator("xpath=..");
const bw = px(await css(box, "border-top-width"));
const br = px(await css(box, "border-top-left-radius"));
const bbg = await css(box, "background-color");
const bsh = await css(box, "box-shadow");
check("1a", "landing", "logo wrapped in bordered box",
  bw > 0 && br > 0 && bbg !== "rgba(0, 0, 0, 0)" && bsh !== "none",
  `border=${bw}px radius=${br}px bg=${bbg} shadow=${bsh !== "none" ? "yes" : "no"}`);

const heading = page.getByText("Gloobal ID", { exact: true }).first();
const hSize = px(await css(heading, "font-size"));
const hWeight = await css(heading, "font-weight");
check("1b", "landing", "'Gloobal ID' heading enlarged", hSize >= 26, `font-size=${hSize}px (was 22px) weight=${hWeight}`);

const homeField = page.getByRole("button", { name: /Phone number/i });
const homeStyle = {
  bg: await css(homeField, "background-color"),
  radius: await css(homeField, "border-top-left-radius"),
  padLeft: await css(homeField, "padding-left"),
  border: await css(homeField, "border-top-width"),
};

// ── SCREEN 2/5 prep: OTP ────────────────────────────────────────────────
console.log("\n== OTP step ==");
await homeField.click();
await digits(MOBILE);
await page.getByRole("button", { name: "Log in", exact: true }).click();
await page.getByText(/VERIFY OTP/i).waitFor({ timeout: 30000 });
await shot("02-otp");

// ── SCREEN 5: Gloobal ID creation ───────────────────────────────────────
console.log("\n== SCREEN 5: Gloobal ID creation (stage 'secureId') ==");
await digits(OTP);
await page.getByRole("button", { name: "Log in", exact: true }).click();
await page.getByRole("button", { name: "Symbol −", exact: true }).waitFor({ timeout: 30000 });
await shot("03-secureid-creation");

const h5 = page.getByText("Gloobal ID", { exact: true }).first();
check("5a", "creation", "'Gloobal ID' label present",
  await h5.isVisible().catch(() => false),
  `font-size=${px(await css(h5, "font-size"))}px`);

const info = page.getByRole("button", { name: /What is a Gloobal ID/i });
const ib = await info.boundingBox();
check("2b", "creation", "info icon at screen top-right",
  ib.x > 210 && ib.y < 100 && ib.x + ib.width <= 420,
  `x=${Math.round(ib.x)} y=${Math.round(ib.y)} (viewport 420 wide)`);

const inBtn = await page.getByRole("button", { name: "IN", exact: true }).count();
const subBtn = await page.getByRole("button", { name: "Submit", exact: true }).count();
check("2d", "creation", "submit button reads 'IN'", inBtn === 1 && subBtn === 0, `IN=${inBtn} Submit=${subBtn}`);

const mark = page.locator('img[aria-hidden="true"]').first();
const markW = await mark.evaluate((el) => el.getBoundingClientRect().width || parseFloat(el.style.width));
check("2c", "creation", "dial watermark reduced", markW < 110 && markW > 60,
  `width=${Math.round(markW)}px (was ~164px at factor 0.74; now factor 0.40)`);

// 1c comparison against the login card's mobile field
const backBtn = page.getByRole("button", { name: "Back", exact: true });
check("5b", "creation", "back button exists", (await backBtn.count()) === 1, `count=${await backBtn.count()}`);
await backBtn.click();
await page.getByText(/VERIFY OTP/i).waitFor({ timeout: 30000 });
check("5b", "creation", "back navigates to OTP step", true, "landed on VERIFY OTP");
await shot("04-back-from-creation-to-otp");

// forward again to referral
await digits(OTP);
await page.getByRole("button", { name: "Log in", exact: true }).click();
await page.getByRole("button", { name: "Symbol −", exact: true }).waitFor({ timeout: 30000 });
await syms(SECURE_ID);
await page.getByRole("button", { name: "IN", exact: true }).click();

// ── SCREEN 3: Referral ──────────────────────────────────────────────────
console.log("\n== SCREEN 3: Referral (stage 'referral') ==");
await page.getByRole("button", { name: /Skip for now/i }).waitFor({ timeout: 30000 });
await shot("05-referral");

const h3 = page.getByText("Gloobal ID", { exact: true }).first();
check("3b", "referral", "'Gloobal ID' label present", await h3.isVisible().catch(() => false),
  `font-size=${px(await css(h3, "font-size"))}px`);

const info3 = page.getByRole("button", { name: /What is a referral/i });
const ib3 = await info3.boundingBox();
check("3c", "referral", "info icon at screen top-right", ib3.x > 210 && ib3.y < 100,
  `x=${Math.round(ib3.x)} y=${Math.round(ib3.y)}`);

const in3 = await page.getByRole("button", { name: "IN", exact: true }).count();
const sub3 = await page.getByRole("button", { name: "Submit", exact: true }).count();
check("3d", "referral", "submit button reads 'IN'", in3 === 1 && sub3 === 0, `IN=${in3} Submit=${sub3}`);

await page.getByRole("button", { name: "Back", exact: true }).click();
// Both stages render a SymbolDialPad, so "Symbol −" is a useless landmark
// here — it is already on screen during the outgoing flip. Wait instead
// for the card's own REFERRAL ID badge to leave, which only happens once
// the stage has actually changed and the flip has settled.
await page.getByText("Referral ID", { exact: true }).waitFor({ state: "hidden", timeout: 30000 });
const stillHasSkip = await page.getByRole("button", { name: /Skip for now/i }).count();
const creationBadge = await page.getByText("Gloobal ID", { exact: true }).first().isVisible();
check("3a", "referral", "back navigates to Gloobal ID creation", stillHasSkip === 0 && creationBadge,
  `referral badge gone, skip count=${stillHasSkip}, creation heading visible=${creationBadge}`);
await shot("06-back-from-referral-to-creation");

// ── SCREEN 4: device security setup ─────────────────────────────────────
console.log("\n== SCREEN 4: device security setup (stage 'deviceSetup') ==");
await page.getByRole("button", { name: "IN", exact: true }).click();
await page.getByRole("button", { name: /Skip for now/i }).waitFor({ timeout: 30000 });
await page.getByRole("button", { name: /Skip for now/i }).click();
await page.getByText("0/6").waitFor({ timeout: 30000 });
await shot("07-pin-setup");
await digits(PIN);
await page.getByRole("button", { name: "Log in", exact: true }).click();
await page.getByText(/Set up device security/i).waitFor({ timeout: 30000 });
await shot("08-device-security-setup");

const faceCircle = page.getByRole("button", { name: /Verify with Face ID/i }).locator("span").first();
const fpCircle = page.getByRole("button", { name: /Verify with fingerprint/i }).locator("span").first();
const fb = await faceCircle.boundingBox();
const pb = await fpCircle.boundingBox();
check("4a", "deviceSetup", "Face ID icon >= 64px", fb.width >= 64, `${Math.round(fb.width)}x${Math.round(fb.height)}px (was 56px)`);
check("4a", "deviceSetup", "Fingerprint icon >= 64px", pb.width >= 64, `${Math.round(pb.width)}x${Math.round(pb.height)}px (was 56px)`);

// ── SCREEN 6: login PIN entry ───────────────────────────────────────────
console.log("\n== SCREEN 6: login PIN entry (stage 'loginAuth') ==");
await page.goto("http://localhost:5199/", { waitUntil: "domcontentloaded" });
await page.getByRole("button", { name: /Flip to log in/i }).waitFor({ timeout: 30000 });
await page.getByRole("button", { name: /Flip to log in/i }).click();
await page.getByRole("button", { name: "Symbol −", exact: true }).waitFor({ timeout: 30000 });
await shot("09-login-secureid");

// 1c: compare the login card's mobile field with the landing phone field
await page.getByRole("button", { name: /Switch to mobile number/i }).click();
const idField = page.getByText("Mobile number", { exact: true }).locator("xpath=..");
await idField.waitFor({ timeout: 10000 });
const idStyle = {
  bg: await css(idField, "background-color"),
  radius: await css(idField, "border-top-left-radius"),
  padLeft: await css(idField, "padding-left"),
  border: await css(idField, "border-top-width"),
};
const same =
  idStyle.bg === homeStyle.bg &&
  idStyle.radius === homeStyle.radius &&
  idStyle.padLeft === homeStyle.padLeft &&
  idStyle.border === homeStyle.border;
check("1c", "landing/ID", "phone field style matches ID-screen field", same,
  `landing{bg:${homeStyle.bg} r:${homeStyle.radius} pad:${homeStyle.padLeft} bw:${homeStyle.border}} vs id{bg:${idStyle.bg} r:${idStyle.radius} pad:${idStyle.padLeft} bw:${idStyle.border}}`);
await shot("10-login-mobile-mode");

await page.getByRole("button", { name: /Switch to Gloobal ID/i }).click();
await page.getByRole("button", { name: "Symbol −", exact: true }).waitFor({ timeout: 10000 });
await syms(SECURE_ID);
await page.getByRole("button", { name: "Log in", exact: true }).last().click();
await page.getByText(/Verify it's you/i).waitFor({ timeout: 30000 });
await shot("11-login-pin-entry");

const h6 = page.getByText("Gloobal ID", { exact: true }).first();
check("6a", "loginAuth", "'Gloobal ID' label present", await h6.isVisible().catch(() => false),
  `font-size=${px(await css(h6, "font-size"))}px`);

const loginFace = page.getByRole("button", { name: /Verify with Face ID/i }).locator("span").first();
const lb = await loginFace.boundingBox();
check("4a", "loginAuth", "login icons unchanged (scoped)", lb.width < 64, `${Math.round(lb.width)}px — original size preserved`);

// ── summary ─────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(70));
const failed = results.filter((r) => !r.pass);
console.log(`RESULT: ${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log("\nFAILURES:");
  for (const f of failed) console.log(`  ${f.fix} [${f.screen}] ${f.desc} — ${f.detail}`);
}
console.log(`\nUncaught page errors: ${pageErrors.length ? pageErrors.join(" | ") : "none"}`);
console.log("=".repeat(70));

await browser.close();
process.exit(failed.length ? 1 : 0);
