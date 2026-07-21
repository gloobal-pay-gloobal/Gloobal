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
// restores which screen to show; every real action still hits the backend
// with symbolId exactly as before.
// ---------------------------------------------------------------------------

const SESSION_KEY = "gloobal.session.v1";

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

/** Persist the signed-in identity. Called once the dashboard is reached. */
export function saveSession(user, phoneNumber = "") {
  if (!user || !user.symbolId) return;
  try {
    window.localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ user, phoneNumber, savedAt: Date.now() })
    );
  } catch {
    // Storage unavailable — the app still works this session, it just
    // won't survive the next reload. Nothing to recover from.
  }
}

/** Returns { user, phoneNumber } if a valid session exists, else null. */
export function loadSession() {
  const raw = safeGet();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Only honour a shape that can actually drive the dashboard. Anything
    // partial (an older/corrupt blob) is treated as no session.
    if (parsed && parsed.user && parsed.user.symbolId) {
      return { user: parsed.user, phoneNumber: parsed.phoneNumber || "" };
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
