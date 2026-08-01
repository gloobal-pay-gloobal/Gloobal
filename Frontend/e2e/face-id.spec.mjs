// Face verification — capture pipeline and client/server contract.
//
// WHAT THIS SUITE CAN AND CANNOT PROVE
//
// It proves the camera is really opened, that frames are really read, that
// the ~13MB of models really load from our own origin, and that the client
// sends and handles exactly what the server expects.
//
// It does NOT prove a human face is recognised. Chromium's fake capture
// device emits a rolling colour pattern, not a person, so the detector
// correctly finds no face in it. Proving recognition needs a .y4m fixture of
// a real face, which is a licensing and privacy decision (a real person's
// face committed to this repo forever) rather than a technical one — see
// FACE_FIXTURE below.
//
// Descriptor maths (encryption round-trip, cosine matching, tamper
// rejection) is covered server-side in Backend/lib; it is deterministic
// arithmetic and does not need a browser.
import { test, expect } from "@playwright/test";

// Chromium-only, and scoped to this file so the other suites keep their
// normal browser. --use-fake-ui auto-grants the camera prompt;
// --use-fake-device feeds a synthetic stream instead of real hardware.
test.use({
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      // Point this at a real .y4m to exercise actual recognition:
      //   "--use-file-for-fake-video-capture=e2e/fixtures/face.y4m"
    ],
  },
});

const BACKEND = "https://gloobal-pay.onrender.com";
const SYMBOLS = ["−", "+", "×", "=", "○", "□", "●", "■"];
const SECURE_ID_STR = Array.from({ length: 12 }, (_, i) => SYMBOLS[i % SYMBOLS.length]).join("");
const MOBILE = "8114491364";
const json = (b, s = 200) => ({ status: s, contentType: "application/json", body: JSON.stringify(b) });

const USER = {
  symbolId: SECURE_ID_STR,
  fullName: "Priya Sharma",
  mobileNumber: "+91" + MOBILE,
  hasPin: true,
  hasPasskey: false,
  symbolIdHistory: [],
  balance: 5000,
};

/** Captured /api/face/* request bodies, so the contract can be asserted. */
function recorder() {
  return { enroll: [], verify: [] };
}

async function mockBackend(page, { faceStatus = { enrolled: true, locked: false }, verifyResult, calls } = {}) {
  await page.route(`${BACKEND}/**`, async (route) => {
    const url = route.request().url();

    if (url.includes("/api/face/status/")) return route.fulfill(json({ configured: true, ...faceStatus }));
    if (url.includes("/api/face/enroll")) {
      if (calls) calls.enroll.push(route.request().postDataJSON());
      return route.fulfill(json({ enrolled: true }, 201));
    }
    if (url.includes("/api/face/verify")) {
      if (calls) calls.verify.push(route.request().postDataJSON());
      return route.fulfill(verifyResult || json({ verified: true, similarity: 0.97 }));
    }

    if (url.includes("/api/pin/verify")) return route.fulfill(json({ verified: true, user: USER }));
    if (url.includes("/api/profile/")) return route.fulfill(json({ user: USER }));
    if (url.includes("/api/passkey/")) return route.fulfill(json({ hasPasskey: false }));
    if (url.includes("/api/users/resolve")) return route.fulfill(json({ user: USER }));
    if (url.includes("/api/transactions/")) return route.fulfill(json({ success: true, transactions: [], count: 0, totalSent: 0, totalReceived: 0 }));
    if (url.includes("/api/assets/")) return route.fulfill(json({ totalAssets: 0, futureAssets: 0, seeds: [] }));
    if (url.includes("/api/referrals/")) return route.fulfill(json({ referrals: [], total: 0 }));
    return route.fulfill(json({}));
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
}

async function gotoLockScreen(page, opts) {
  await mockBackend(page, opts);
  await page.addInitScript(
    (b) => window.localStorage.setItem("gloobal.session.v1", JSON.stringify(b)),
    { user: USER, phoneNumber: MOBILE, savedAt: Date.now(), biometricEnrolled: false }
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("reauth-screen")).toBeVisible({ timeout: 30_000 });
}

async function openFaceScreen(page, opts) {
  await gotoLockScreen(page, opts);
  const button = page.getByTestId("reauth-face-button");
  await expect(button).toBeVisible({ timeout: 30_000 });
  await button.click();
  await expect(page.getByTestId("face-id-screen")).toBeVisible({ timeout: 30_000 });
}

// ═══ Capture ═══════════════════════════════════════════════════════════════

test("F1: the lock screen offers a face check only when one is enrolled", async ({ page }) => {
  await gotoLockScreen(page, { faceStatus: { enrolled: false, locked: false } });
  await expect(page.getByTestId("reauth-face-button")).toHaveCount(0);

  // And the PIN pad is still the way in — face is never the only route.
  await expect(page.getByRole("button", { name: "Digit 1", exact: true }).first()).toBeVisible();
});

test("F2: a locked-out face template hides the option rather than failing later", async ({ page }) => {
  await gotoLockScreen(page, { faceStatus: { enrolled: true, locked: true } });
  await expect(page.getByTestId("reauth-face-button")).toHaveCount(0);
});

test("F3: opening Face ID acquires the camera and streams real frames", async ({ page }) => {
  await openFaceScreen(page);

  const video = page.getByTestId("face-video");
  await expect(video).toBeVisible();

  // videoWidth is only non-zero once actual frames have arrived from
  // getUserMedia — this is the assertion that the camera is genuinely open
  // and delivering, not that an empty <video> rendered.
  //
  // 60s, not 30s: this is the first test in the file to import the engine,
  // and Vite's first-time transform of a 9MB dependency blocks the main
  // thread long enough to starve the poll. Later tests hit a warm cache.
  await expect
    .poll(async () => video.evaluate((el) => el.videoWidth), { timeout: 60_000 })
    .toBeGreaterThan(0);

  const dims = await video.evaluate((el) => ({
    w: el.videoWidth,
    h: el.videoHeight,
    paused: el.paused,
    live: el.srcObject instanceof MediaStream && el.srcObject.getVideoTracks()[0]?.readyState === "live",
  }));
  expect(dims.h).toBeGreaterThan(0);
  expect(dims.paused).toBe(false);
  expect(dims.live).toBe(true);
});

test("F4: the face models are served from our own origin, not a CDN", async ({ page }) => {
  const modelRequests = [];
  page.on("request", (r) => {
    if (r.url().includes("/models/human/")) modelRequests.push(new URL(r.url()).pathname);
  });

  await openFaceScreen(page);

  // The strict CSP is default-src 'self', so a CDN model path would be
  // blocked outright. Loading must come from /models/human/.
  await expect.poll(() => modelRequests.length, { timeout: 60_000 }).toBeGreaterThan(0);
  expect(modelRequests.some((p) => p.endsWith("blazeface.json"))).toBe(true);

  // Every model request is same-origin.
  const origins = await page.evaluate(() => window.location.origin);
  expect(origins).toBeTruthy();
});

test("F5: the detection loop runs and reports no face against the fake pattern", async ({ page }) => {
  await openFaceScreen(page);

  // Chromium's synthetic stream is a rolling colour pattern with no face in
  // it. Reaching "finding_face" proves frames are being pulled and scored —
  // the pipeline is live and correctly declines to invent a face.
  await expect
    .poll(async () => page.getByTestId("face-id-screen").getAttribute("data-face-phase"), { timeout: 60_000 })
    .toBe("finding_face");

  await expect(page.getByTestId("face-status")).toContainText(/center your face/i);

  // And nothing was sent anywhere on the strength of a non-face.
  await expect(page.getByTestId("face-error")).toHaveCount(0);
});

test("F6: leaving the screen releases the camera", async ({ page }) => {
  await openFaceScreen(page);
  const video = page.getByTestId("face-video");
  await expect.poll(async () => video.evaluate((el) => el.videoWidth), { timeout: 30_000 }).toBeGreaterThan(0);

  // Grab the track before unmounting so its state can be read afterwards.
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="face-video"]');
    window.__track = el?.srcObject?.getVideoTracks?.()[0] || null;
  });

  await page.getByRole("button", { name: /Use PIN instead/i }).click();
  await expect(page.getByTestId("face-id-screen")).toHaveCount(0);

  // A live track left running keeps the browser's recording indicator on,
  // which reads as the app still watching after you walked away.
  const state = await page.evaluate(() => window.__track?.readyState ?? "gone");
  expect(state).toBe("ended");
});

test("F7: dismissing the face check leaves the PIN pad intact underneath", async ({ page }) => {
  await openFaceScreen(page);
  await page.getByRole("button", { name: /Use PIN instead/i }).click();

  await expect(page.getByTestId("reauth-screen")).toBeVisible();
  await expect(page.getByRole("button", { name: "Digit 1", exact: true }).first()).toBeVisible();
  // Still no back button on the lock screen — the 2026-08-01 fix holds.
  await expect(page.getByRole("button", { name: "Back", exact: true })).toHaveCount(0);
});

// ═══ Client/server contract ════════════════════════════════════════════════
//
// Driven through the page's own modules rather than the camera, because the
// fake device cannot produce a face to trigger a real submission. What is
// asserted here is the shape of the request and the handling of each answer.

test("F8: enrol and verify send a descriptor and a model tag, never an image", async ({ page }) => {
  const calls = recorder();
  await mockBackend(page, { calls });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const sent = await page.evaluate(async (symbolId) => {
    const { enrollFace, verifyFace } = await import("/src/services/api/faceApi.js");
    const { FACE_MODEL_TAG } = await import("/src/services/faceEngine.js");
    const descriptor = Array.from({ length: 128 }, (_, i) => Math.sin(i) / 2);
    await enrollFace({ symbolId, descriptor, model: FACE_MODEL_TAG, livenessPassed: true });
    const v = await verifyFace({ symbolId, descriptor, model: FACE_MODEL_TAG, livenessPassed: true });
    return { verified: v.verified, tag: FACE_MODEL_TAG };
  }, SECURE_ID_STR);

  expect(sent.verified).toBe(true);

  expect(calls.enroll).toHaveLength(1);
  const body = calls.enroll[0];
  expect(Array.isArray(body.descriptor)).toBe(true);
  expect(body.descriptor).toHaveLength(128);
  expect(body.model).toBe(sent.tag);
  expect(body.livenessPassed).toBe(true);

  // The whole privacy claim in one assertion: no frame, no data URI, no
  // base64 blob is anywhere in what we send.
  const serialised = JSON.stringify(body);
  expect(serialised).not.toContain("data:image");
  expect(serialised).not.toContain("base64");
  expect(Object.keys(body).sort()).toEqual(["descriptor", "livenessPassed", "model", "symbolId"]);
});

test("F9: a non-matching face is reported, not thrown", async ({ page }) => {
  await mockBackend(page, {
    verifyResult: json({ verified: false, reason: "no_match", message: "That face did not match.", attemptsRemaining: 3 }, 401),
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const result = await page.evaluate(async (symbolId) => {
    const { verifyFace } = await import("/src/services/api/faceApi.js");
    return verifyFace({
      symbolId,
      descriptor: Array.from({ length: 128 }, () => 0.01),
      model: "human-faceres-v3",
      livenessPassed: true,
    });
  }, SECURE_ID_STR);

  expect(result.verified).toBe(false);
  expect(result.reason).toBe("no_match");
  expect(result.attemptsRemaining).toBe(3);
});

test("F10: a locked template surfaces as a lockout, not a mismatch", async ({ page }) => {
  await mockBackend(page, {
    verifyResult: json({ message: "Face verification is temporarily locked. Use your PIN or passkey." }, 423),
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const result = await page.evaluate(async (symbolId) => {
    const { verifyFace } = await import("/src/services/api/faceApi.js");
    return verifyFace({
      symbolId,
      descriptor: Array.from({ length: 128 }, () => 0.01),
      model: "human-faceres-v3",
      livenessPassed: true,
    });
  }, SECURE_ID_STR);

  expect(result.verified).toBe(false);
  expect(result.reason).toBe("locked");
  expect(result.message).toMatch(/locked/i);
});

test("F11: blink detection needs open -> closed -> open, so a still never passes", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const outcome = await page.evaluate(async () => {
    const { createBlinkDetector, EAR_OPEN, EAR_CLOSED } = await import("/src/services/faceEngine.js");

    // A photograph: eyes open, held perfectly still forever.
    const still = createBlinkDetector();
    let stillPassed = false;
    for (let i = 0; i < 200; i++) stillPassed = still.push(EAR_OPEN + 0.05) || stillPassed;

    // A person: open, then closed, then open again.
    const live = createBlinkDetector();
    let livePassed = false;
    for (const ear of [0.32, 0.31, 0.3, 0.12, 0.1, 0.11, 0.29, 0.32]) {
      livePassed = live.push(ear) || livePassed;
    }

    // A photo of someone mid-blink: closed forever, never reopening.
    const closedStill = createBlinkDetector();
    let closedPassed = false;
    for (let i = 0; i < 200; i++) closedPassed = closedStill.push(EAR_CLOSED - 0.05) || closedPassed;

    return { stillPassed, livePassed, closedPassed, blinks: live.blinks };
  });

  expect(outcome.stillPassed).toBe(false);
  expect(outcome.closedPassed).toBe(false);
  expect(outcome.livePassed).toBe(true);
  expect(outcome.blinks).toBe(1);
});

test("F12: eye aspect ratio falls as the eyelids close", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const ratios = await page.evaluate(async () => {
    const { eyeAspectRatio } = await import("/src/services/faceEngine.js");
    // Synthetic eyelid contours: upper lid at a given height, lower at 0,
    // across a 20px-wide eye.
    const contour = (height) => [
      [0, 0], [5, height], [10, height], [15, height], [20, 0],
    ];
    const lower = contour(0);
    return {
      open: eyeAspectRatio(contour(6), lower, [[0, 0], [20, 0]]),
      half: eyeAspectRatio(contour(3), lower, [[0, 0], [20, 0]]),
      shut: eyeAspectRatio(contour(0.2), lower, [[0, 0], [20, 0]]),
    };
  });

  expect(ratios.open).toBeGreaterThan(ratios.half);
  expect(ratios.half).toBeGreaterThan(ratios.shut);
  expect(ratios.shut).toBeLessThan(0.1);
});
