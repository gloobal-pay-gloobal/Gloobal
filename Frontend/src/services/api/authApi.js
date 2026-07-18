import { apiClient, ApiError } from "../httpClient";
import { checkAndRecordAttempt, clearAttempts } from "../../lib/rateLimiter";

// Render's free tier spins the backend down after idle and takes 20-50s to
// wake back up on the next request — the default 15s client timeout was
// tripping mid-wake-up and reading as "login doesn't work," when the
// backend was actually just still booting. Any call that can plausibly be
// the very first request of a session (OTP send/verify, login, resolve)
// gets this longer, cold-start-tolerant timeout instead of the 15s default.
const COLD_START_TIMEOUT_MS = 45_000;
const LOGIN_TIMEOUT_MS = COLD_START_TIMEOUT_MS;

// ---------------------------------------------------------------------------
// Real Gloobal backend surface (see CLAUDE.md's endpoint table). The
// backend has no auth middleware, no JWT, no session cookies — symbolId is
// passed explicitly in every call's body/query, and every response is read
// for its actual shape (`{ user: {...} }`, `{ message }`, etc.), not
// assumed. checkAndRecordAttempt/clearAttempts stay as the client-side UX
// throttle in front of the credential-verification calls — the real rate
// limit lives server-side.
// ---------------------------------------------------------------------------

export async function sendOtp(mobileNumber, purpose = "registration") {
  try {
    await apiClient.post("/api/otp/send", { mobileNumber, purpose }, { timeoutMs: COLD_START_TIMEOUT_MS });
  } catch (err) {
    if (err instanceof ApiError && err.status === 0) {
      throw new Error("Couldn't reach the server — it may still be waking up. Please try again in a few seconds.");
    }
    throw err;
  }
}

export async function verifyOtp(mobileNumber, otp, purpose = "registration") {
  checkAndRecordAttempt(`verify-otp:${mobileNumber}`);
  try {
    await apiClient.post("/api/otp/verify", { mobileNumber, otp, purpose }, { timeoutMs: COLD_START_TIMEOUT_MS });
    clearAttempts(`verify-otp:${mobileNumber}`);
  } catch (err) {
    // A timed-out/never-answered request (status 0) means the backend never
    // actually judged the OTP — don't burn down the person's real attempts
    // budget for a cold start that wasn't their mistake.
    if (err instanceof ApiError && err.status === 0) {
      clearAttempts(`verify-otp:${mobileNumber}`);
      throw new Error("Couldn't reach the server — it may still be waking up. Please try again in a few seconds.");
    }
    throw err;
  }
}

/** POST /api/register-symbol — called once, after the referral stage
 * (skip included), with everything collected across phone/secureId/
 * referral. */
export async function register(payload) {
  const result = await apiClient.post("/api/register-symbol", payload);
  return {
    user: result.user || { symbolId: payload.symbolId, fullName: payload.fullName, mobileNumber: payload.mobileNumber },
    alreadyRegistered: result.alreadyRegistered,
  };
}

/** POST /api/pin/set — sets the PIN for a freshly registered (or
 * PIN-less) Secure ID. */
export async function setPin(symbolId, pin) {
  await apiClient.post("/api/pin/set", { symbolId, secureId: symbolId, pin });
}

/** POST /api/login — verifies Secure ID + PIN against the backend. */
export async function login(symbolId, pin) {
  checkAndRecordAttempt("login");
  try {
    const result = await apiClient.post(
      "/api/login",
      { symbolId, secureId: symbolId, pin },
      { timeoutMs: LOGIN_TIMEOUT_MS }
    );
    clearAttempts("login");
    return { user: result.user || { symbolId } };
  } catch (err) {
    // status 0 means the request never got a response at all (timeout or
    // network failure) — a cold backend, not a wrong Secure ID/PIN. That
    // shouldn't burn down the local guessing throttle, or a person who hit
    // one slow cold start ends up locked out of their next, perfectly
    // correct, attempt.
    if (err instanceof ApiError && err.status === 0) {
      clearAttempts("login");
      throw new Error("Couldn't reach the server — it may still be waking up. Please try again in a few seconds.");
    }
    throw err;
  }
}

/** GET /api/users/resolve?identifier=... — looks up a user by symbolId or
 * mobile number. Used by Send Money's receiver lookup, and by mobile-number
 * login to find the Secure ID behind a typed mobile number before
 * continuing into the normal PIN step. */
export async function resolveUser(identifier) {
  try {
    const result = await apiClient.get(`/api/users/resolve?identifier=${encodeURIComponent(identifier)}`, {
      timeoutMs: LOGIN_TIMEOUT_MS,
    });
    if (!result.user) throw new Error("No user found.");
    return result.user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 0) {
      throw new Error("Couldn't reach the server — it may still be waking up. Please try again in a few seconds.");
    }
    throw err;
  }
}

/** POST /api/transactions/send — PIN-verified server-side; this is the
 * one real money-moving call in the app. */
export async function sendTransaction(payload) {
  checkAndRecordAttempt(`send:${payload.senderSymbolId}`);
  const result = await apiClient.post("/api/transactions/send", payload);
  clearAttempts(`send:${payload.senderSymbolId}`);
  return result.transaction || {};
}

/** GET /api/profile/:symbolId */
export async function getProfile(symbolId) {
  const result = await apiClient.get(`/api/profile/${encodeURIComponent(symbolId)}`);
  return result.user || { symbolId };
}

/** GET /api/transactions/history/:symbolId — a per-viewer projection:
 * `direction` and `counterparty` are computed relative to whichever
 * symbolId was requested. */
export async function getHistory(symbolId) {
  const result = await apiClient.get(`/api/transactions/history/${encodeURIComponent(symbolId)}`);
  return Array.isArray(result.transactions) ? result.transactions : [];
}

// --- Passkey / WebAuthn device verification ---------------------------------

export async function passkeyStatus(symbolId) {
  return apiClient.post("/api/passkey/status", { symbolId });
}

export async function passkeyRegisterOptions(symbolId) {
  return apiClient.post("/api/passkey/register/options", { symbolId });
}

export async function passkeyRegisterVerify(symbolId, response) {
  return apiClient.post("/api/passkey/register/verify", { symbolId, response });
}

export async function passkeyAuthOptions(symbolId) {
  return apiClient.post("/api/passkey/auth/options", { symbolId });
}

export async function passkeyAuthVerify(symbolId, response) {
  return apiClient.post("/api/passkey/auth/verify", { symbolId, response });
}
