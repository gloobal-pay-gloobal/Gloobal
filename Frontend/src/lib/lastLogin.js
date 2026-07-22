// "Last login: 22 Jul 2026, 1:19 PM" on the login screen.
//
// The backend has no last-login field today, so the timestamp is kept
// locally, per Gloobal ID, and written on every successful sign-in. If a
// future GET /api/profile/:symbolId does start returning lastLoginAt (or
// lastLogin), that answer wins — see the read order in App.jsx. No new
// backend endpoint was added for this.

const KEY_PREFIX = "gloobal.lastLogin.";

const keyFor = (symbolId) => KEY_PREFIX + symbolId;

/** The stored ISO timestamp for a Gloobal ID, or null. */
export function readLastLogin(symbolId) {
  if (!symbolId) return null;
  try {
    const raw = localStorage.getItem(keyFor(symbolId));
    if (!raw) return null;
    return Number.isNaN(new Date(raw).getTime()) ? null : raw;
  } catch {
    // Private mode / storage disabled — the bar just falls back to
    // "First time logging in" rather than breaking the login screen.
    return null;
  }
}

/** Stamps "now" as the last successful login for a Gloobal ID. */
export function recordLastLogin(symbolId) {
  if (!symbolId) return;
  try {
    localStorage.setItem(keyFor(symbolId), new Date().toISOString());
  } catch {
    /* not worth failing a successful login over */
  }
}

/** "22 Jul 2026, 1:19 PM" in the viewer's own timezone, or null if the
 * timestamp can't be parsed. */
export function formatLastLogin(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${date}, ${time}`;
}
