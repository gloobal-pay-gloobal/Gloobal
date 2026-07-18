// ---------------------------------------------------------------------------
// Centralized HTTP client for the real Gloobal backend. Thin fetch wrapper —
// fetch already covers everything this app needs (JSON, timeouts via
// AbortController, headers).
//
// The real backend has no auth middleware, no JWT, no session cookies (see
// Backend/server.js) — every call passes symbolId directly in its own
// body/query, so there is no token store and no `credentials: "include"`
// here. Don't reintroduce either without a matching backend change.
// ---------------------------------------------------------------------------

const DEFAULT_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

// Netlify build env can hand us VITE_API_URL/VITE_API_BASE_URL set to
// something relative or empty (e.g. a leftover "/api" from an old
// Netlify-function-proxy config) — that silently turns every call into a
// same-origin request against Netlify itself, which 404s since Netlify
// serves no such route. Only trust an env value that's actually an
// absolute http(s) URL; anything else falls back to the real Render
// backend, same as when neither var is set at all.
const ENV_CANDIDATE = import.meta.env?.VITE_API_URL || import.meta.env?.VITE_API_BASE_URL || "";
const RAW_API_BASE = /^https?:\/\//i.test(ENV_CANDIDATE) ? ENV_CANDIDATE : "https://gloobal-pay.onrender.com";
export const API_BASE = RAW_API_BASE.replace(/\/+$/, "").replace(/\/api$/i, "");
export const apiUrl = (path) => `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

async function request(method, path, body, options = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  signal?.addEventListener("abort", () => controller.abort());

  try {
    const res = await fetch(apiUrl(path), {
      method,
      headers: { "Content-Type": "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const contentType = res.headers.get("content-type") ?? "";
    const parsed = contentType.includes("application/json") ? await res.json().catch(() => null) : null;

    if (!res.ok) {
      const message = (parsed && parsed.message) || `Request to ${path} failed with ${res.status}`;
      throw new ApiError(message, res.status, parsed);
    }

    return parsed;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(`Request to ${path} timed out after ${timeoutMs}ms`, 0, null);
    }
    throw new ApiError(`Network error calling ${path}: ${err.message}`, 0, null);
  } finally {
    clearTimeout(timeoutId);
  }
}

export const apiClient = {
  get: (path, options) => request("GET", path, undefined, options),
  post: (path, body, options) => request("POST", path, body, options),
  put: (path, body, options) => request("PUT", path, body, options),
  delete: (path, options) => request("DELETE", path, undefined, options),
};

// Fire-and-forget wake-up call for Render's free-tier cold start. Any HTTP
// request — even one that 404s, since there's no dedicated healthcheck
// route — is enough to make Render's proxy spin the sleeping backend back
// up. Called once as early as possible (App mount), well before the person
// finishes picking a country/typing their number and hits submit, so by the
// time the real POST /api/otp/send goes out the backend has already had a
// head start on waking up instead of eating that 20-50s cold start inside
// the OTP flow's own timeout window. Never awaited, never surfaces an
// error — a failed warm-up just means no head start, not a broken app.
export function warmUpBackend() {
  fetch(apiUrl("/"), { method: "GET" }).catch(() => {});
}
