// Backend/lib/fxRates.js
//
// Live exchange rates for the settlement engine, backed by
// open.er-api.com — chosen specifically because it needs no API key and no
// account. Every other stage of this build assumes a Render deploy with an
// already-full .env; adding "and now also provision an FX API key before
// any of this works" would have been a real deploy blocker for a prototype.
// Swapping providers later only means changing PROVIDER_BASE_URL and
// parseProviderResponse below — nothing else in this file or its callers
// is provider-specific.
//
// IMPORTANT: this was written and reviewed in a sandboxed environment whose
// network proxy blocks arbitrary outbound domains (including this one), so
// the live call itself could not be exercised end-to-end from there. The
// logic is straightforward — one GET, one JSON shape — but treat the first
// real call from Render as the actual first test of it, not a formality.
//
// Every rate this module hands back either came from a real fetch or from
// a previous real fetch cached in Mongo (ExchangeRate) — it never invents
// one. If neither is available, getRate throws rather than returning a
// guessed 1.0, the same "fail closed instead of fabricating a number"
// choice lib/faceCrypto.js makes for a different kind of missing input.
const ExchangeRate = require('../models/ExchangeRate');

const PROVIDER_NAME = 'open.er-api.com';
const PROVIDER_BASE_URL = 'https://open.er-api.com/v6/latest';

// This free tier updates once every 24h on the provider's side, so
// fetching more often than that just re-reads the same numbers. 6 hours
// keeps a deploy responsive to the provider's own refresh without hammering
// it every request.
const FX_RATE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

async function fetchLiveRates(baseCurrency) {
  const url = `${PROVIDER_BASE_URL}/${encodeURIComponent(baseCurrency)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });

  if (!response.ok) {
    throw new Error(`${PROVIDER_NAME} responded ${response.status} for base ${baseCurrency}`);
  }

  const body = await response.json();

  if (body.result !== 'success' || !body.rates || typeof body.rates !== 'object') {
    throw new Error(`${PROVIDER_NAME} returned an unexpected shape for base ${baseCurrency}`);
  }

  return body.rates; // { USD: 1, INR: 85.02, EUR: 0.92, ... }
}

// Fetches every rate for one base currency in a single call (the provider
// returns the whole table, not just the pair asked for) and upserts all of
// them — so asking for INR->USD also refreshes INR->EUR, INR->JPY, etc. for
// free, and the next call for any of those is a cache hit instead of a
// second network round trip.
async function refreshRatesForBase(baseCurrency) {
  const rates = await fetchLiveRates(baseCurrency);
  const fetchedAt = new Date();

  const writes = Object.entries(rates)
    .filter(([toCurrency]) => toCurrency !== baseCurrency)
    .map(([toCurrency, rate]) => ({
      updateOne: {
        filter: { fromCurrency: baseCurrency, toCurrency },
        update: { $set: { rate, source: PROVIDER_NAME, fetchedAt } },
        upsert: true,
      },
    }));

  if (writes.length) {
    await ExchangeRate.bulkWrite(writes, { ordered: false });
  }

  return fetchedAt;
}

/**
 * Returns { rate, source, fetchedAt, stale } for 1 unit of `from` in `to`.
 * Same-currency pairs short-circuit to a live rate of 1 without touching
 * the network or the cache.
 *
 * Throws if there is no live rate available AND no cached rate to fall
 * back on — never returns a fabricated number.
 */
async function getRate(fromCurrency, toCurrency) {
  const from = String(fromCurrency || '').toUpperCase();
  const to = String(toCurrency || '').toUpperCase();

  if (!from || !to) {
    throw new Error('getRate requires both fromCurrency and toCurrency.');
  }

  if (from === to) {
    return { rate: 1, source: 'identity', fetchedAt: new Date(), stale: false };
  }

  const cached = await ExchangeRate.findOne({ fromCurrency: from, toCurrency: to });
  const cacheIsFresh = cached && (Date.now() - cached.fetchedAt.getTime()) < FX_RATE_MAX_AGE_MS;

  if (cacheIsFresh) {
    return { rate: cached.rate, source: cached.source, fetchedAt: cached.fetchedAt, stale: false };
  }

  try {
    await refreshRatesForBase(from);
  } catch (fetchError) {
    // The live fetch failed. A stale cached rate is still a real,
    // previously-observed rate — better than refusing settlement outright
    // for a prototype — but callers get `stale: true` so they can decide
    // whether that's good enough (e.g. log it, or surface it in the
    // Settlement record's rateSource).
    if (cached) {
      return { rate: cached.rate, source: `${cached.source} (stale, refresh failed: ${fetchError.message})`, fetchedAt: cached.fetchedAt, stale: true };
    }
    throw new Error(`No exchange rate available for ${from}->${to}: ${fetchError.message}`);
  }

  const refreshed = await ExchangeRate.findOne({ fromCurrency: from, toCurrency: to });

  if (!refreshed) {
    // The provider answered but this specific currency wasn't in its
    // table (its coverage is roughly 160 currencies; the country list
    // supports 142, so this should be rare, not impossible).
    if (cached) {
      return { rate: cached.rate, source: `${cached.source} (stale, ${to} missing from latest fetch)`, fetchedAt: cached.fetchedAt, stale: true };
    }
    throw new Error(`${PROVIDER_NAME} does not publish a rate for ${from}->${to}, and no cached rate exists.`);
  }

  return { rate: refreshed.rate, source: refreshed.source, fetchedAt: refreshed.fetchedAt, stale: false };
}

module.exports = { getRate, refreshRatesForBase, FX_RATE_MAX_AGE_MS, PROVIDER_NAME };
