// ---------------------------------------------------------------------------
// Client-side attempt throttling for credential-verification calls
// (login, PIN, OTP). This is NOT the rate limit — it's a UX-layer
// speed bump that also happens to reduce noise against the real one.
//
// The actual rate limit has to live on the backend, in front of
// /auth/verify-pin, /auth/verify-otp, and /auth/login: this file runs in
// the caller's own browser, so anyone can clear it, edit it out of the
// bundle, or call the endpoint directly with curl. Nothing here should be
// mistaken for the security control — see PRODUCTION_HARDENING_AUDIT.md
// for the server-side requirement this stands in front of.
//
// What this DOES do, honestly:
//   - Stops a person's own repeated mis-taps from hammering the network.
//   - Gives immediate, local feedback ("wait 4s") instead of waiting on a
//     round trip to learn a real rate limit was hit.
//   - Adds friction to naive scripted guessing from this same tab.
// ---------------------------------------------------------------------------

interface AttemptState {
  count: number;
  lockedUntil: number;
}

const state = new Map<string, AttemptState>();

const MAX_ATTEMPTS_BEFORE_BACKOFF = 3;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30_000;

export class RateLimitedError extends Error {
  constructor(public readonly retryAfterMs: number) {
    super(`Too many attempts — try again in ${Math.ceil(retryAfterMs / 1000)}s`);
    this.name = "RateLimitedError";
  }
}

/** Call before attempting a verification. Throws RateLimitedError if the
 * caller is currently backed off; otherwise records the attempt. */
export function checkAndRecordAttempt(key: string): void {
  const now = Date.now();
  const entry = state.get(key) ?? { count: 0, lockedUntil: 0 };

  if (entry.lockedUntil > now) {
    throw new RateLimitedError(entry.lockedUntil - now);
  }

  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS_BEFORE_BACKOFF) {
    const overBy = entry.count - MAX_ATTEMPTS_BEFORE_BACKOFF;
    entry.lockedUntil = now + Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** overBy);
  }
  state.set(key, entry);
}

/** Call after a verification succeeds, to clear the counter for that key
 * (a correct PIN shouldn't leave the next unrelated action backed off). */
export function clearAttempts(key: string): void {
  state.delete(key);
}
