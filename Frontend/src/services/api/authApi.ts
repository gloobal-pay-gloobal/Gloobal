import { apiClient, ApiError } from "../httpClient";
import { checkAndRecordAttempt, clearAttempts } from "../../lib/rateLimiter";

// Render's free tier spins the backend down after idle and takes 20-50s to
// wake back up on the next request — the default 15s client timeout was
// tripping mid-wake-up and reading as "login doesn't work," when the
// backend was actually just still booting. Any call that can plausibly be
// the very first request of a session (OTP send/verify, login, resolve)
// gets this longer, cold-start-tolerant timeout instead of the 15s default.
// OTP send is *the* most exposed case — it's usually the first network call
// the app makes at all, so it hit this failure mode most often before it
// got the same timeout login already had.
const COLD_START_TIMEOUT_MS = 45_000;
const LOGIN_TIMEOUT_MS = COLD_START_TIMEOUT_MS;

// ---------------------------------------------------------------------------
// Real Gloobal backend surface (see CLAUDE.md's endpoint table). The
// backend has no auth middleware, no JWT, no session cookies — symbolId is
// passed explicitly in every call's body/query, and every response is read
// for its actual shape (`{ user: {...} }`, `{ message }`, etc.), not
// assumed. checkAndRecordAttempt/clearAttempts stay as the client-side UX
// throttle in front of the credential-verification calls — the real rate
// limit lives server-side; see lib/rateLimiter.ts.
// ---------------------------------------------------------------------------

export interface BackendUser {
  symbolId: string;
  fullName?: string;
  mobileNumber?: string;
  referralCount?: number;
  referredBy?: string | null;
  hasPasskey?: boolean;
}

export async function sendOtp(mobileNumber: string, purpose: string = "registration"): Promise<void> {
  try {
    await apiClient.post("/api/otp/send", { mobileNumber, purpose }, { timeoutMs: COLD_START_TIMEOUT_MS });
  } catch (err) {
    if (err instanceof ApiError && err.status === 0) {
      throw new Error("Couldn't reach the server — it may still be waking up. Please try again in a few seconds.");
    }
    throw err;
  }
}

export async function verifyOtp(mobileNumber: string, otp: string, purpose: string = "registration"): Promise<void> {
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

export interface RegisterPayload {
  fullName?: string;
  mobileNumber: string;
  symbolId: string;
  referredBy?: string;
}

export interface RegisterResult {
  user: BackendUser;
  alreadyRegistered?: boolean;
}

/** POST /api/register-symbol — called once, after the referral stage
 * (skip included), with everything collected across phone/secureId/
 * referral. */
export async function register(payload: RegisterPayload): Promise<RegisterResult> {
  const result = await apiClient.post<{ user?: BackendUser; alreadyRegistered?: boolean }>(
    "/api/register-symbol",
    payload
  );
  return {
    user: result.user || { symbolId: payload.symbolId, fullName: payload.fullName, mobileNumber: payload.mobileNumber },
    alreadyRegistered: result.alreadyRegistered,
  };
}

/** POST /api/pin/set — sets the PIN for a freshly registered (or
 * PIN-less) Secure ID. */
export async function setPin(symbolId: string, pin: string): Promise<void> {
  await apiClient.post("/api/pin/set", { symbolId, secureId: symbolId, pin });
}

export interface LoginResult {
  user: BackendUser;
}

/** POST /api/login — verifies Secure ID + PIN against the backend. */
export async function login(symbolId: string, pin: string): Promise<LoginResult> {
  checkAndRecordAttempt("login");
  try {
    const result = await apiClient.post<{ user?: BackendUser }>(
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
 * login (see RootApp's handleLoginWithMobile) to find the Secure ID behind
 * a typed mobile number before continuing into the normal PIN step. */
export async function resolveUser(identifier: string): Promise<BackendUser> {
  try {
    const result = await apiClient.get<{ user?: BackendUser }>(
      `/api/users/resolve?identifier=${encodeURIComponent(identifier)}`,
      { timeoutMs: LOGIN_TIMEOUT_MS }
    );
    if (!result.user) throw new Error("No user found.");
    return result.user;
  } catch (err) {
    if (err instanceof ApiError && err.status === 0) {
      throw new Error("Couldn't reach the server — it may still be waking up. Please try again in a few seconds.");
    }
    throw err;
  }
}

export interface SendTransactionPayload {
  senderSymbolId: string;
  receiverSymbolId: string;
  amount: number;
  note?: string;
  pin: string;
  idempotencyKey: string;
}

export interface TransactionResult {
  referenceId?: string;
  createdAt?: string;
  [key: string]: unknown;
}

/** POST /api/transactions/send — PIN-verified server-side; this is the
 * one real money-moving call in the app. */
export async function sendTransaction(payload: SendTransactionPayload): Promise<TransactionResult> {
  checkAndRecordAttempt(`send:${payload.senderSymbolId}`);
  const result = await apiClient.post<{ transaction?: TransactionResult }>("/api/transactions/send", payload);
  clearAttempts(`send:${payload.senderSymbolId}`);
  return result.transaction || {};
}

/** GET /api/profile/:symbolId */
export async function getProfile(symbolId: string): Promise<BackendUser> {
  const result = await apiClient.get<{ user?: BackendUser }>(`/api/profile/${encodeURIComponent(symbolId)}`);
  return result.user || { symbolId };
}

export interface TransactionCounterparty {
  fullName: string;
  symbolId: string;
}

/** Shape actually returned by GET /api/transactions/history/:symbolId — a
 * per-viewer projection (see server.js: `direction` and `counterparty` are
 * computed relative to whichever symbolId was requested), distinct from
 * the sender/receiver shape POST /api/transactions/send returns. */
export interface TransactionHistoryEntry {
  id: string;
  referenceId: string;
  direction: "sent" | "received";
  amount: number;
  currency: string;
  status: string;
  note: string;
  counterparty: TransactionCounterparty | null;
  createdAt: string;
}

/** GET /api/transactions/history/:symbolId */
export async function getHistory(symbolId: string): Promise<TransactionHistoryEntry[]> {
  const result = await apiClient.get<{ transactions?: TransactionHistoryEntry[] }>(
    `/api/transactions/history/${encodeURIComponent(symbolId)}`
  );
  return Array.isArray(result.transactions) ? result.transactions : [];
}

// --- Passkey / WebAuthn device verification ---------------------------------

export async function passkeyStatus(symbolId: string): Promise<{ hasPasskey: boolean; user?: BackendUser }> {
  return apiClient.post("/api/passkey/status", { symbolId });
}

export async function passkeyRegisterOptions(symbolId: string): Promise<unknown> {
  return apiClient.post("/api/passkey/register/options", { symbolId });
}

export async function passkeyRegisterVerify(symbolId: string, response: unknown): Promise<{ verified: boolean }> {
  return apiClient.post("/api/passkey/register/verify", { symbolId, response });
}

export async function passkeyAuthOptions(symbolId: string): Promise<unknown> {
  return apiClient.post("/api/passkey/auth/options", { symbolId });
}

export async function passkeyAuthVerify(symbolId: string, response: unknown): Promise<{ verified: boolean }> {
  return apiClient.post("/api/passkey/auth/verify", { symbolId, response });
}
