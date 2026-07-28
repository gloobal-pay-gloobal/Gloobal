import { apiClient } from "../httpClient";

// --- Gloobal Creators: cashback sharing --------------------------------------
// A Creator (a business or merchant on Gloobal) chooses for themselves what
// share of every payment they hand back to the person paying — anywhere from
// 0% to 7%. Gloobal does not set this centrally. Whatever they pick becomes
// the cashbackRate on the asset seed planted for the payer, which is in turn
// that payer's PayLater limit.
//
// Stored as a decimal everywhere (1% = 0.01, 7% = 0.07) so it can be
// multiplied against an amount without a conversion step in between.

export const CREATOR_MAX_CASHBACK_RATE = 0.07;

/** PATCH /api/creator/cashback-rate — set the share this Creator gives back. */
export async function setCashbackRate(symbolId, cashbackRate) {
  const result = await apiClient.patch("/api/creator/cashback-rate", { symbolId, cashbackRate });
  return { cashbackRate: Number(result.cashbackRate) || 0 };
}
