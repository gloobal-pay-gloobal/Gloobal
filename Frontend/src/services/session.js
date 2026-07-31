// ---------------------------------------------------------------------------
// Client-side session persistence.
//
// The app has no server-issued token or cookie (see httpClient.js) — the
// signed-in identity is just the `registeredUser` object the backend
// returned, held in React state. That state is lost on every remount:
// a page refresh, a PWA relaunch, a service-worker update reload, or the
// OS restoring a backgrounded tab all drop the person back at the phone
// screen, which reads as "it logged me out by itself."
//
// This stores the minimum needed to re-enter the dashboard on the next
// load: the identity the downstream screens actually read (symbolId,
// fullName, referralCount, …) plus the raw national phone number used for
// display. It is NOT a security token — there is no backend session to
// validate it against, and anyone can read or edit it in devtools. It only
// restores *whose* account to re-authenticate against; it does not by
// itself grant access to the dashboard. Reaching the dashboard from a
// restored session always costs a passkey check or a PIN (see the
// "reauth" stage in App.jsx), so a copied blob buys an attacker the
// masked ID on the lock screen and nothing else. Every real action still
// hits the backend with symbolId exactly as before.
// ---------------------------------------------------------------------------

const SESSION_KEY = "gloobal.session.v1";

// A restored session stops being honoured after this long. Someone who
// has not opened the app in a month re-enters through the full phone →
// OTP flow rather than being shown a lock screen for an account they may
// no longer be using on this device.
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// localStorage can throw (Safari private mode, disabled storage), so every
// access is guarded — a storage failure degrades to "no persisted
// session," never a crash.
function safeGet() {
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

/**
 * Persist the signed-in identity. Called once the dashboard is reached.
 *
 * `biometricEnrolled` is remembered so the lock screen knows whether to
 * fire a passkey prompt on open or go straight to the PIN pad. Passing it
 * as undefined keeps whatever was already stored, so the dashboard's
 * every-render save can't wipe a flag the enrolment step just set.
 */
export function saveSession(user, phoneNumber = "", biometricEnrolled) {
  if (!user || !user.symbolId) return;
  const previous = readRaw();
  const enrolled =
    biometricEnrolled === undefined ? Boolean(previous?.biometricEnrolled) : Boolean(biometricEnrolled);
  try {
    window.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        user,
        phoneNumber,
        savedAt: Date.now(),
        loggedInAt: previous?.loggedInAt || new Date().toISOString(),
        biometricEnrolled: enrolled,
      })
    );
  } catch {
    // Storage unavailable — the app still works this session, it just
    // won't survive the next reload. Nothing to recover from.
  }
}

// Parses the stored blob without validating or clearing it. Used by the
// writer above, which needs the previous value to merge against.
function readRaw() {
  const raw = safeGet();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Returns { user, phoneNumber, biometricEnrolled } if a valid, unexpired
 * session exists, else null.
 */
export function loadSession() {
  const raw = safeGet();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Only honour a shape that can actually drive the dashboard. Anything
    // partial (an older/corrupt blob) is treated as no session.
    if (parsed && parsed.user && parsed.user.symbolId) {
      // savedAt is absent on blobs written before it existed. Those are
      // treated as fresh rather than expired — dropping someone mid-use
      // because of a field they never had is the worse failure.
      const age = parsed.savedAt ? Date.now() - parsed.savedAt : 0;
      if (age > SESSION_MAX_AGE_MS) {
        clearSession();
        return null;
      }
      return {
        user: parsed.user,
        phoneNumber: parsed.phoneNumber || "",
        biometricEnrolled: Boolean(parsed.biometricEnrolled),
      };
    }
  } catch {
    // Corrupt JSON — fall through to clearing it below.
  }
  clearSession();
  return null;
}

/** Wipe the session. Called on explicit logout (Start over). */
export function clearSession() {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing we can do if removal fails; a stale blob is harmless since
    // loadSession re-validates its shape on every read.
  }
}
