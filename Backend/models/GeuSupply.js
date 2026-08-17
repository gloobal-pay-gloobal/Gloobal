const mongoose = require('mongoose');

// The GEU analogue of CoinReserve.js — a singleton tracking GEU's own
// supply and backing. Deliberately NOT the same model as CoinReserve, and
// deliberately not layered on top of it: CoinReserve's two-number shape
// (reserve, issued) is correct for Coin, which has exactly one creation
// reason (a mint, always fiat-backed 1:1) and one destruction reason (a
// redeem). GEU has two DIFFERENT creation reasons that must never be
// collapsed into each other — entry-backed GEU and growth-created GEU are
// economically distinct events (see server.js's GEU routes and
// AUDIT_GEU_REPORT.md's Phase 2/3 mapping notes) — so a two-number model
// cannot represent GEU without hiding exactly the distinction section 12 of
// the GEU brief asks to keep visible. This is the one deliberate
// architectural departure from "reuse CoinReserve," and it is a strict
// superset: every reconciliation CoinReserve supports (created vs
// destroyed vs circulating) still holds here, just split by reason.
//
// Every field here is written by exactly one code path (see server.js):
//   capitalBackingReferenceInr — only POST /api/geu/entry, on a successful
//     entry mint. The reference-currency (INR) value of capital that has
//     entered. This is GEU's "reserve" analogue — NOT spendable fiat sitting
//     in an account, but the recorded INR-reference value backing entry-
//     minted GEU. Growth-created GEU has no capital behind it by
//     definition (see GROWTH_UNBACKED_BY_CAPITAL below) and never adds to
//     this figure.
//   createdFromEntry — only POST /api/geu/entry. Sum of every entry mint's
//     geuAmount, ever.
//   createdFromGrowth — only POST /api/geu/growth, and only the POSITIVE
//     portion of a growth event (a negative adjustment is destruction, not
//     negative creation — see destroyedFromNegativeGrowth below).
//   destroyedFromRedemption — only POST /api/geu/redeem.
//   destroyedFromNegativeGrowth — only POST /api/geu/growth, when
//     actualGrowthAmount < 0. Tracked separately from redemption so
//     "how much GEU has left the system via a user choosing to exit" and
//     "how much was removed by a growth adjustment" never get conflated in
//     a reconciliation.
//   reserved / pending — defined by schema, not yet written by any route.
//     No current GEU flow holds funds mid-flight the way a cross-border
//     Settlement's `reservedBalance` can (see CountryCurrencyPool.js) — a
//     redemption in this implementation either settles within the same
//     atomic transaction or the whole thing rolls back (see Phase 8 in
//     AUDIT_GEU_REPORT.md). Present now, at 0, so introducing a genuinely
//     asynchronous/held state later is a value change, not a schema change
//     — same reasoning CountryCurrencyPool.reservedBalance's own comment
//     gives for existing at 0 today.
const geuSupplySchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'global',
    },

    referenceCurrency: {
      type: String,
      default: 'INR',
      trim: true,
      uppercase: true,
    },

    capitalBackingReferenceInr: { type: Number, default: 0, min: 0 },
    createdFromEntry: { type: Number, default: 0, min: 0 },
    createdFromGrowth: { type: Number, default: 0, min: 0 },
    destroyedFromRedemption: { type: Number, default: 0, min: 0 },
    destroyedFromNegativeGrowth: { type: Number, default: 0, min: 0 },
    reserved: { type: Number, default: 0, min: 0 },
    pending: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

const GeuSupply = mongoose.model('GeuSupply', geuSupplySchema);

// Same upsert-on-first-use shape as CoinReserve.load() / CountryCurrencyPool.loadOrCreate —
// see either's own comment for why upsert instead of find-then-create.
GeuSupply.load = async function loadGeuSupply(session) {
  const options = { upsert: true, returnDocument: 'after', ...(session ? { session } : {}) };

  return GeuSupply.findOneAndUpdate(
    { key: 'global' },
    {
      $setOnInsert: {
        referenceCurrency: 'INR',
        capitalBackingReferenceInr: 0,
        createdFromEntry: 0,
        createdFromGrowth: 0,
        destroyedFromRedemption: 0,
        destroyedFromNegativeGrowth: 0,
        reserved: 0,
        pending: 0,
      },
    },
    options
  );
};

// circulating = everything ever created, minus everything ever destroyed —
// the reconciliation brief section 12 asks for. Derived on read rather than
// stored: unlike CoinReserve's `issued` (which IS the authoritative figure
// a redeem checks liquidity against), nothing here needs the circulating
// total to be a single atomically-guarded field — every route that changes
// supply guards against the specific counter it moves (e.g. a redemption
// checks the account's own geuBalance, not this derived total), so storing
// a fifth redundant number would only be one more thing that could drift.
GeuSupply.circulating = (doc) =>
  (doc?.createdFromEntry || 0) +
  (doc?.createdFromGrowth || 0) -
  (doc?.destroyedFromRedemption || 0) -
  (doc?.destroyedFromNegativeGrowth || 0);

module.exports = GeuSupply;
