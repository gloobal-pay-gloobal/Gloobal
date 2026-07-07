import { apiClient } from "../httpClient";
import { checkAndRecordAttempt, clearAttempts } from "../../lib/rateLimiter";

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
  await apiClient.post("/api/otp/send", { mobileNumber, purpose });
}

export async function verifyOtp(mobileNumber: string, otp: string, purpose: string = "registration"): Promise<void> {
  checkAndRecordAttempt(`verify-otp:${mobileNumber}`);
  await apiClient.post("/api/otp/verify", { mobileNumber, otp, purpose });
  clearAttempts(`verify-otp:${mobileNumber}`);
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
  const result = await apiClient.post<{ user?: BackendUser }>("/api/login", { symbolId, secureId: symbolId, pin });
  clearAttempts("login");
  return { user: result.user || { symbolId } };
}

/** GET /api/users/resolve?identifier=... — looks up a user by symbolId or
 * mobile number, used by Send Money's receiver lookup. */
export async function resolveUser(identifier: string): Promise<BackendUser> {
  const result = await apiClient.get<{ user?: BackendUser }>(`/api/users/resolve?identifier=${encodeURIComponent(identifier)}`);
  if (!result.user) throw new Error("No user found.");
  return result.user;
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

/** GET /api/transactions/history/:symbolId */
export async function getHistory(symbolId: string): Promise<TransactionResult[]> {
  const result = await apiClient.get<{ transactions?: TransactionResult[] }>(
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
