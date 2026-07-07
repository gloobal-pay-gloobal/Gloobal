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
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
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
export const apiUrl = (path: string) => `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

async function request<TResponse>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<TResponse> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  options.signal?.addEventListener("abort", () => controller.abort());

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
      const message = (parsed && (parsed as { message?: string }).message) || `Request to ${path} failed with ${res.status}`;
      throw new ApiError(message, res.status, parsed);
    }

    return parsed as TResponse;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError(`Request to ${path} timed out after ${timeoutMs}ms`, 0, null);
    }
    throw new ApiError(`Network error calling ${path}: ${(err as Error).message}`, 0, null);
  } finally {
    clearTimeout(timeoutId);
  }
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>("POST", path, body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) => request<T>("PUT", path, body, options),
  delete: <T>(path: string, options?: RequestOptions) => request<T>("DELETE", path, undefined, options),
};
