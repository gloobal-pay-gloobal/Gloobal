import { apiClient } from "../httpClient";

// --- My Assets ---------------------------------------------------------------
// Cashback planted at payment time grows 1%/month (compounded) toward the
// original amount paid. The backend derives every value (current worth, years
// to full) live from each seed's plantedAt, so this layer just passes the
// shape straight through — see Backend/server.js's /api/assets routes.

/** GET /api/assets/:symbolId — the account's planted seeds plus the derived
 * totals. Returns the zero-shape when the account has no seeds yet. */
export async function getAssets(symbolId) {
  const result = await apiClient.get(`/api/assets/${encodeURIComponent(symbolId)}`);
  return {
    totalAssets: Number(result.totalAssets) || 0,
    futureAssets: Number(result.futureAssets) || 0,
    seeds: Array.isArray(result.seeds) ? result.seeds : [],
    avgYearsToTarget: Number(result.avgYearsToTarget) || 0,
    payLaterLimit: Number(result.payLaterLimit) || 0,
  };
}

/** GET /api/assets/paylater/:symbolId — PayLater limit is always the live
 * total of the account's assets. Ledger is a phase-2 feature (empty for now). */
export async function getPayLater(symbolId) {
  const result = await apiClient.get(`/api/assets/paylater/${encodeURIComponent(symbolId)}`);
  return {
    limit: Number(result.limit) || 0,
    available: Number(result.available) || 0,
    pendingDues: Number(result.pendingDues) || 0,
    transactions: Array.isArray(result.transactions) ? result.transactions : [],
  };
}

/** POST /api/assets/plant-seed — plant a seed from a cashback-earning payment.
 * P2P sends (cashbackRate 0) are rejected server-side. */
export async function plantSeed(payload) {
  const result = await apiClient.post("/api/assets/plant-seed", payload);
  return result.seed || null;
}
