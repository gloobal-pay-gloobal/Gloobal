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
    // Whether the referral code (if one was sent) actually landed. The
    // backend never fails a registration over a bad code, so this is the
    // only way the caller can tell the difference.
    referralApplied: result.referralApplied,
    referralWarning: result.referralWarning || null,
  };
}

/** POST /api/pin/set — sets the PIN for a freshly registered (or
 * PIN-less) Secure ID. */
export async function setPin(symbolId, pin) {
  await apiClient.post("/api/pin/set", { symbolId, secureId: symbolId, pin });
}

/** POST /api/pin/verify — confirms the account's PIN without logging in.
 * Used as the fallback confirmation when a device has no biometric enrolled
 * and something still has to be proven before it happens (renaming a Gloobal
 * ID, for one). Throws with the backend's own message on a bad/locked PIN. */
export async function verifyPin(symbolId, pin) {
  const result = await apiClient.post("/api/pin/verify", { symbolId, pin });
  if (!result?.verified) throw new Error(result?.message || "That PIN wasn't recognized.");
  return true;
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

/** Does this Gloobal ID belong to a real account — i.e. can it be used as
 * a referral code?
 *
 * The mirror image of checkSymbolAvailability below, and deliberately a
 * separate function rather than a reuse of it: that one treats any unclear
 * answer as "free to claim", so a flaky lookup can never block somebody
 * from registering. Here the safe fallback is the opposite way round — an
 * unclear answer must not reject a referral code that is probably genuine,
 * so only an explicit 404 counts as "no such ID".
 *
 * Returns true | false | null, where null means "couldn't tell". */
export async function referralCodeExists(symbolId) {
  try {
    const result = await apiClient.get(`/api/users/resolve?identifier=${encodeURIComponent(symbolId)}`, {
      timeoutMs: LOGIN_TIMEOUT_MS,
    });
    return Boolean(result.user);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return false;
    return null;
  }
}

/** PATCH /api/profile/change-symbol-id — renames the account's Gloobal ID.
 * The current ID is the identity proof, matching how every other route in
 * this backend works. */
export async function changeSymbolId(currentSymbolId, newSymbolId) {
  const result = await apiClient.patch("/api/profile/change-symbol-id", { currentSymbolId, newSymbolId });
  return { newSymbolId: result.newSymbolId || newSymbolId, user: result.user || null };
}

/** Is this Gloobal ID still free to claim?
 *
 * Built on the resolve endpoint that already exists rather than a new
 * backend route: a symbolId that resolves to somebody is, by definition,
 * already taken. Anything that isn't a clear "this belongs to someone"
 * answer — a 404, a cold-start timeout, a malformed response — counts as
 * available, because POST /api/register-symbol remains the real
 * uniqueness authority. A flaky lookup must never lock someone out of
 * registering an ID that is genuinely free.
 */
export async function checkSymbolAvailability(symbolId) {
  try {
    const result = await apiClient.get(`/api/users/resolve?identifier=${encodeURIComponent(symbolId)}`, {
      timeoutMs: LOGIN_TIMEOUT_MS,
    });
    return { available: !result.user, user: result.user || null };
  } catch (err) {
    // A 404 is a real answer: the backend looked and found nobody, so the
    // ID is genuinely free.
    if (err instanceof ApiError && err.status === 404) return { available: true, user: null };
    // Anything else — a cold-start timeout, a 5xx, an offline moment — is
    // not an answer at all. Returning `true` here (as this used to) turned
    // every backend hiccup into a confident "Available ✓" over an ID that
    // might well be taken. `null` says "couldn't tell" so each caller can
    // decide: registration stays permissive and lets POST /api/register-symbol
    // be the real authority, while any screen that *displays* availability
    // must not claim one.
    return { available: null, user: null };
  }
}

/** POST /api/transactions/send — PIN-verified server-side; this is the
 * one real money-moving call in the app. */
export async function sendTransaction(payload) {
  checkAndRecordAttempt(`send:${payload.senderSymbolId}`);
  const result = await apiClient.post("/api/transactions/send", payload);
  clearAttempts(`send:${payload.senderSymbolId}`);
  // The whole receipt, not just the transaction record: the sender's new
  // balance, the cashback withheld, and the seed it planted are all decided
  // server-side and sit alongside `transaction`, not inside it.
  return { ...result, transaction: result.transaction || {} };
}

/** GET /api/profile/:symbolId */
export async function getProfile(symbolId) {
  const result = await apiClient.get(`/api/profile/${encodeURIComponent(symbolId)}`);
  return result.user || { symbolId };
}

/** GET /api/referrals/:symbolId — everyone who registered using this
 * Gloobal ID as their referral code. The backend deliberately returns
 * Gloobal IDs and join dates only, no contact details, so this is the whole
 * shape: { referredSymbolId, createdAt, status }. */
export async function getReferrals(symbolId) {
  const result = await apiClient.get(`/api/referrals/${encodeURIComponent(symbolId)}`);
  return Array.isArray(result.referrals) ? result.referrals : [];
}

/** GET /api/transactions/history/:symbolId — a per-viewer projection:
 * `direction` and `counterparty` are computed relative to whichever
 * symbolId was requested. */
export async function getHistory(symbolId) {
  const result = await apiClient.get(`/api/transactions/history/${encodeURIComponent(symbolId)}`);
  return Array.isArray(result.transactions) ? result.transactions : [];
}

/** GET /api/transactions/:symbolId — the same per-viewer projection as
 * getHistory, plus the account's lifetime totals. One call, so the balance
 * card's PAID and RECEIVED figures and the week's bars can never be built
 * from three different reads of the ledger. */
export async function getTransactionSummary(symbolId, type = "all") {
  const result = await apiClient.get(
    `/api/transactions/${encodeURIComponent(symbolId)}?type=${encodeURIComponent(type)}`
  );
  return {
    transactions: Array.isArray(result.transactions) ? result.transactions : [],
    totalSent: Number(result.totalSent) || 0,
    totalReceived: Number(result.totalReceived) || 0,
  };
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
