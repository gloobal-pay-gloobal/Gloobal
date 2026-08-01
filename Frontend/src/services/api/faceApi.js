import { apiClient, ApiError } from "../httpClient";

// Face verification transport.
//
// Every call carries a descriptor — an array of floats — and never an image.
// The frames stay in the browser; see services/faceEngine.js.
//
// This is an additional factor. Nothing here signs anyone in on its own: a
// verified face unlocks a step that the passkey or PIN has already gated, or
// confirms a sensitive action. The server enforces that too, but it is worth
// stating on the client so no future screen mistakes it for a login.

/** POST /api/face/enroll — records the reference face for an account. */
export async function enrollFace({ symbolId, descriptor, model, livenessPassed }) {
  return apiClient.post("/api/face/enroll", { symbolId, descriptor, model, livenessPassed });
}

/**
 * POST /api/face/verify — scores a fresh capture against the enrolled face.
 *
 * A non-match is a 401 and a lockout is a 423, both of which the http client
 * raises as ApiError. Neither is an exception in the "something broke" sense
 * — they are the two ordinary answers — so they are unwrapped into a plain
 * result object and only genuine failures are rethrown.
 */
export async function verifyFace({ symbolId, descriptor, model, livenessPassed }) {
  try {
    const result = await apiClient.post("/api/face/verify", {
      symbolId,
      descriptor,
      model,
      livenessPassed,
    });
    return { verified: Boolean(result?.verified), similarity: result?.similarity ?? null };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 400)) {
      return {
        verified: false,
        reason: err.body?.reason || "no_match",
        message: err.message,
        attemptsRemaining: err.body?.attemptsRemaining,
      };
    }
    if (err instanceof ApiError && err.status === 423) {
      return { verified: false, reason: "locked", message: err.message };
    }
    // 409 (model mismatch) and 404 (not enrolled) are real problems the
    // caller has to handle differently, so they keep throwing.
    throw err;
  }
}

/** GET /api/face/status/:symbolId — enrolled? locked? configured at all? */
export async function faceStatus(symbolId) {
  try {
    return await apiClient.get(`/api/face/status/${encodeURIComponent(symbolId)}`);
  } catch {
    // Status is decoration — a screen should fall back to "no face enrolled"
    // rather than break because the probe failed.
    return { enrolled: false, locked: false, configured: false };
  }
}

/** DELETE /api/face/:symbolId — erases the template. */
export async function deleteFace(symbolId) {
  return apiClient.delete(`/api/face/${encodeURIComponent(symbolId)}`);
}
