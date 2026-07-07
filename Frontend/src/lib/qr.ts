

import type { SessionToken } from "../types";

// ---------------------------------------------------------------------------
// Receive screen — shared constants/helpers for the QR that a person shows
// to receive funds/verification. Lives up here near the other module-level
// constants; the screen component itself is defined further down, next to
// AddBankScreen / GlobalCoverageScreen.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// The model here is: ONE permanent Global ID per person, which never
// changes. What rotates every 2 minutes is a short-lived *session token*
// that is bound to that Global ID. Conceptually, the backend maintains a
// token store shaped like:
//
//   Global ID (permanent)
//       ├── Session Token A — valid 2 min, then discarded
//       ├── Session Token B — the next 2 min
//       ├── Session Token C — ...
//
// Every token in that list resolves back to the exact same Global ID
// profile. The QR only ever encodes the current session token — never the
// Global ID or any personal data directly — so a scan can't leak identity
// on its own, and a captured/expired token is useless once it rotates out
// (no replay). This sandbox has no live backend, so MOCK_generateSessionToken
// simulates the mint below; swap its body for a real
// `POST /api/v1/qr/generate` call (passing the permanent globalId) to go
// live. Everything downstream — the countdown, the fade transition, the
// identity card — stays keyed off the same unchanging globalId prop.
// ---------------------------------------------------------------------------
export const QR_TTL_SECONDS = 120;

// Deterministic string hash -> seeded PRNG (mulberry32). Given the same
// token this always produces the same module grid, which is what lets the
// QR fade smoothly between "old pattern" and "new pattern" on refresh.
export function hashSeed(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

// Mints a new 2-minute session token for an existing, permanent Global ID.
// A real backend would:
//   1. Look up the caller's permanent Global ID (already authenticated).
//   2. Generate a random session credential and sign it (e.g. JWT/HMAC)
//      so it can't be forged.
//   3. Store it in the token table above against that same Global ID, with
//      an expiry, so any of several concurrently-valid tokens still verify.
//   4. Return { token, expiresAt } — the signed token is opaque; it does
//      NOT contain readable personal data, only enough for the backend to
//      trace it back to the right account and confirm it hasn't expired.
// Here we fake the signature with a seeded hash instead of real HMAC, but
// the shape — payload bound to globalId + expiry, plus a signature — mirrors
// what a real signed token looks like.
export async function MOCK_generateSessionToken(globalId: string): Promise<SessionToken> {
  await new Promise((res) => setTimeout(res, 350)); // simulate network latency
  const issuedAt = Date.now();
  const expiresAt = issuedAt + QR_TTL_SECONDS * 1000;
  const nonce = Array.from({ length: 12 }, () =>
    "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]
  ).join("");
  // Payload binds this token to the permanent Global ID + a one-time nonce
  // + expiry — never anything else about the person.
  const payload = btoa(`${globalId}|${issuedAt}|${nonce}`);
  // Mock signature so a hand-edited payload won't verify — a real backend
  // signs this with a server-side secret instead of a client-seeded hash.
  const signature = Math.floor(hashSeed(`${payload}::${globalId}`)() * 1e9).toString(36);
  return { token: `${payload}.${signature}`, expiresAt, globalId };
}

// Darkens a hex color if needed so it keeps strong luminance contrast
// against the white background — real camera QR scanners threshold on
// brightness, not hue, so a colored module still has to read as clearly
// "dark" at a glance, or scans start failing intermittently.
export function ensureScanSafeDark(hex: string, maxLightness = 0.4): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const l = (Math.max(r, g, b) + Math.min(r, g, b)) / 2;
  if (l <= maxLightness) return hex;
  const scale = maxLightness / l;
  const clamp = (v: number) => Math.round(Math.min(255, v * 255 * scale));
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;
}
