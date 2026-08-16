// Backend/lib/settlementEngine.js
//
// Stage 3 of the multi-currency architecture (schema was Stage 1, live FX
// was Stage 2): turns a completed person-to-person Transaction into a real
// cross-border settlement record when the sender and receiver belong to
// countries whose local currencies differ. See CountryCurrencyPool.js's
// header comment for exactly what "source pool credited / destination pool
// debited" means — this module is the code that does what that comment
// describes.
//
// This runs strictly AFTER server.js's performTransfer has already moved
// money between the two User.balance documents, inside the same
// best-effort step as the AssetSeed planting call right next to it: a
// settlement failure must never fail, reverse, or delay an
// already-successful payment. It only ever adds an audit trail on top of a
// transfer that already happened — see settleCrossBorderPayment's own
// try/catch for how that's enforced.
//
// A same-currency payment — by far the common case today, since every
// account defaults to countryIso 'IN' until users start setting a real one
// — is not a "trivial settlement" here. It's not a cross-border payment at
// all, so this returns null for it without creating any pool or settlement
// row, or making the live FX call. Only a genuine currency mismatch does.
const crypto = require('crypto');
const Country = require('../models/Country');
const CountryCurrencyPool = require('../models/CountryCurrencyPool');
const Settlement = require('../models/Settlement');
const { getRate } = require('./fxRates');

// Deliberately excludes 0/O/1/I — this ID ends up on a receipt someone may
// read aloud or copy by hand, same reasoning as the Secure ID symbol set
// existing elsewhere in this codebase avoiding ambiguous characters.
const SETTLEMENT_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SETTLEMENT_ID_LENGTH = 16;

function createSettlementId() {
  let id = 'GLOOBAL-STL-';
  for (let i = 0; i < SETTLEMENT_ID_LENGTH; i += 1) {
    id += SETTLEMENT_ID_CHARS[crypto.randomInt(SETTLEMENT_ID_CHARS.length)];
  }
  return id;
}

// countryIso -> Country doc. Country is seed data (seeded by
// scripts/seed-countries-currencies.mjs) that only changes when a country
// is added to the registration picker, so an in-process cache is worth it —
// a query per payment for a table that changes maybe once a year is not.
const countryCache = new Map();
let countryCacheLoadedAt = 0;
const COUNTRY_CACHE_MAX_AGE_MS = 10 * 60 * 1000;

async function getCountry(iso) {
  const key = String(iso || '').toUpperCase();
  const stale = Date.now() - countryCacheLoadedAt > COUNTRY_CACHE_MAX_AGE_MS;

  if (stale) {
    const rows = await Country.find({}).lean();
    countryCache.clear();
    for (const row of rows) countryCache.set(row.iso, row);
    countryCacheLoadedAt = Date.now();
  }

  return countryCache.get(key) || null;
}

/**
 * Settles a completed Transaction across country pools if, and only if, the
 * sender's and receiver's local currencies differ.
 *
 * Returns the created Settlement document, or null if either: this was a
 * same-currency payment (nothing to settle — not an error), or the
 * settlement could not be completed (logged to console, never thrown — see
 * the header comment on why a settlement failure must not touch the
 * already-successful payment it's describing).
 */
async function settleCrossBorderPayment({ transaction, sender, receiver, amount }) {
  try {
    const [sourceCountry, destinationCountry] = await Promise.all([
      getCountry(sender.countryIso),
      getCountry(receiver.countryIso),
    ]);

    if (!sourceCountry || !destinationCountry) {
      // Two different situations look the same here and deserve different
      // volumes of logging. An empty cache almost certainly means
      // scripts/seed-countries-currencies.mjs hasn't been run on this
      // deployment yet — an expected state right after this feature ships,
      // not a bug, and one that would otherwise log on every single payment
      // until someone runs it. A non-empty cache missing just this one ISO
      // is an actual data gap worth knowing about.
      if (countryCache.size > 0) {
        console.error(
          `Settlement skipped for ${transaction.referenceId}: unrecognised countryIso ` +
            `(sender ${sender.countryIso}, receiver ${receiver.countryIso}) not present ` +
            `in the seeded Country collection.`
        );
      }
      return null;
    }

    const sourceCurrency = sourceCountry.localCurrency;
    const destinationCurrency = destinationCountry.localCurrency;

    if (sourceCurrency === destinationCurrency) {
      return null; // Domestic payment — no border crossed, nothing to settle.
    }

    const { rate, source: rateSource } = await getRate(sourceCurrency, destinationCurrency);
    const sourceAmount = amount;
    const destinationAmount = Math.round(amount * rate * 100) / 100;

    const [sourcePool, destinationPool] = await Promise.all([
      CountryCurrencyPool.loadOrCreate(sourceCountry.iso, destinationCurrency, sourceCurrency),
      CountryCurrencyPool.loadOrCreate(destinationCountry.iso, sourceCurrency, destinationCurrency),
    ]);

    // Source country's pool (keyed by the destination currency) is credited
    // the sender's local-currency amount; the destination country's pool
    // (keyed by the source currency) is debited its own local-currency
    // amount to fund the credit on the receiving side — the mirror-image
    // pair CountryCurrencyPool.js's header comment walks through.
    //
    // These are two separate writes, not one atomic operation — this
    // module runs outside server.js's money-moving Mongo transaction by
    // design, so a crash between them is possible. If the destination debit
    // fails after the source credit succeeded, the catch block below
    // reverts the credit rather than leaving the pools out of balance.
    const creditedSourcePool = await CountryCurrencyPool.findByIdAndUpdate(
      sourcePool._id,
      { $inc: { availableBalance: sourceAmount, totalBalance: sourceAmount } },
      { new: true }
    );

    let debitedDestinationPool;

    try {
      debitedDestinationPool = await CountryCurrencyPool.findByIdAndUpdate(
        destinationPool._id,
        { $inc: { availableBalance: -destinationAmount, totalBalance: -destinationAmount } },
        { new: true }
      );
    } catch (poolError) {
      await CountryCurrencyPool.findByIdAndUpdate(sourcePool._id, {
        $inc: { availableBalance: -sourceAmount, totalBalance: -sourceAmount },
      });
      throw poolError;
    }

    const settlement = await Settlement.create({
      settlementId: createSettlementId(),
      transactionId: transaction._id,
      sourceCountryIso: sourceCountry.iso,
      sourceCurrency,
      sourceAmount,
      sourcePoolId: creditedSourcePool._id,
      destinationCountryIso: destinationCountry.iso,
      destinationCurrency,
      destinationAmount,
      destinationPoolId: debitedDestinationPool._id,
      rate,
      rateSource,
      status: 'settled',
      settledAt: new Date(),
    });

    return settlement;
  } catch (settlementError) {
    // Mirrors the AssetSeed planting try/catch immediately next to this
    // call in server.js: the payment already succeeded, so a settlement
    // failure is logged and swallowed here, never surfaced as a failed
    // payment. No placeholder Settlement row is written on this path —
    // fabricating one with a fake pool/rate just to satisfy the schema
    // would be a worse record than no record, the same "fail closed, don't
    // invent a number" choice lib/fxRates.js documents for a missing rate.
    console.error(`Cross-border settlement failed for transaction ${transaction?.referenceId}:`, settlementError);
    return null;
  }
}

module.exports = { settleCrossBorderPayment };
