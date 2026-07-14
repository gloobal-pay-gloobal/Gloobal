// ---------------------------------------------------------------------------
// Fixes the "refreshing the PWA dumps you back to the start" problem.
// sessionStorage (not localStorage) is deliberate: it survives a refresh or
// a PWA relaunch from the same browsing session, but still clears once the
// tab/app is fully closed — so a refresh resumes exactly where you were,
// without turning this into a permanent "stay logged in forever" mechanism,
// which is a separate, bigger decision (real auth tokens, expiry, etc.)
// than what a quick session-continuity fix should quietly introduce.
//
// SECURITY NOTE (fixed after an earlier review pass): this used to also
// persist `secureId` here. That was wrong — the Secure ID is the person's
// actual security credential, functionally a password, and sessionStorage
// is exactly as script-readable as localStorage (an XSS bug reads either
// one just as easily; the only difference between them is lifetime, not
// exposure). It's been removed. The real, honest tradeoff that creates:
// after a refresh, ReceiveScreen's "Symbolic ID" preview falls back to its
// placeholder glyphs instead of showing the person's real one, until
// they've re-entered it somewhere in that session. That's the correct
// price to pay — never the other way around.
// ---------------------------------------------------------------------------

import type { RegistrationStage } from "../types";

const STORAGE_KEY = "gloobal:session";

export interface PersistedSession {
  stage: RegistrationStage;
  dialCountryIso: string;
  phoneNumber: string;
  // Only ever written once stage is already "dashboard" — i.e. this is the
  // backend's real, confirmed account identifier, not a secureId someone
  // is still mid-typing during registration/login (that stays excluded,
  // per the note above). Functionally public (it's what /api/users/resolve
  // and Receive's QR already hand out), not a credential on its own — the
  // PIN is what actually gates the account.
  symbolId?: string;
  fullName?: string;
}

export function saveSession(data: PersistedSession): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage can genuinely fail (Safari private mode, quota exceeded,
    // storage disabled by the user) — losing session continuity in that
    // case is fine; it should never crash the app.
  }
}

export function loadSession(): PersistedSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.stage !== "string") return null;
    return parsed as PersistedSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // see saveSession — best-effort only.
  }
}

// ---------------------------------------------------------------------------
// Country preference: deliberately separate from the session above, and in
// localStorage (not sessionStorage) — it's not a credential, just "which
// flag was last selected," and it needs to survive a full app close/reopen,
// not just a refresh. Without this, dialCountry silently reset to India on
// every fresh PWA open (sessionStorage is gone the moment the tab/app fully
// closes), and anyone outside India using the Mobile Number login tab
// without re-picking their flag got their number prefixed +91 instead of
// their real country code — which then 404s the resolve lookup and reads
// as "Secure ID not found," even for a genuinely registered account. Never
// cleared on logout: a person's country doesn't change just because they
// signed out.
// ---------------------------------------------------------------------------

const COUNTRY_STORAGE_KEY = "gloobal:country";

export function saveCountryPreference(iso: string): void {
  try {
    localStorage.setItem(COUNTRY_STORAGE_KEY, iso);
  } catch {
    // best-effort only — see saveSession.
  }
}

export function loadCountryPreference(): string | null {
  try {
    return localStorage.getItem(COUNTRY_STORAGE_KEY);
  } catch {
    return null;
  }
}
