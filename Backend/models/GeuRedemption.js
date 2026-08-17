const mongoose = require('mongoose');

// One row per GEU redemption/exit (brief sections 14/15) — the compensating
// event that moves value out of GEU and into a spendable local-currency
// balance, without ever deleting the GEU or editing history (brief's own
// explicit requirement, matching Invariant 6 / AUDIT_REPORT.md's existing
// "reversals are compensating transactions, never edits" position for the
// fiat side).
const geuRedemptionSchema = new mongoose.Schema(
  {
    redemptionId: { type: String, required: true, unique: true, trim: true },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    symbolId: { type: String, required: true, index: true },

    geuAmountRedeemed: { type: Number, required: true, min: 0 },

    // GEU's reference value, in the reference currency (INR) — always
    // numerically equal to geuAmountRedeemed today (1 GEU = ₹1), stored as
    // its own field rather than assumed, for the same self-describing-row
    // reasoning GeuEntryMint.referenceAmount already documents.
    referenceCurrency: { type: String, required: true, trim: true, uppercase: true, default: 'INR' },
    referenceAmount: { type: Number, required: true, min: 0 },

    // What the user actually receives. Their own account currency — never
    // client-supplied, resolved from Country.localCurrency exactly like
    // every other money-out-of-Gloobal path in this codebase.
    destinationCurrency: { type: String, required: true, trim: true, uppercase: true },
    localCurrencyAmount: { type: Number, required: true, min: 0 },

    // 1 for an INR redemption. For a foreign-currency redemption, the exact
    // rate captured at redemption time via lib/fxRates.js#getRate — never
    // recalculated afterward (brief section 15).
    exchangeRate: { type: Number, required: true, min: 0 },
    rateSource: { type: String, default: 'identity', trim: true },
    rateTimestamp: { type: Date, required: true },

    // Set only when the destination currency differs from the reference
    // currency and this redemption's fiat leg released liquidity from the
    // user's own-country CountryCurrencyPool — the SAME model and the same
    // atomic conditional-release pattern lib/settlementEngine.js already
    // uses for a real cross-border payment's destination leg (brief section
    // 16's "reuse the existing... pool architecture", "must not bypass
    // gross liquidity checks"). Not a Settlement row: Settlement's schema is
    // shaped for a two-sided payment (a source AND a destination country,
    // sender AND receiver) — a redemption is one-sided (GEU exits, one
    // country's pool releases local currency; there is no second account
    // and no source-side pool leg to record), so forcing it into that
    // schema would leave several of Settlement's required fields
    // meaningless. Recording the pool directly here, instead, keeps this
    // row self-describing without inventing an ill-fitting reuse of a
    // schema built for a different shape of event.
    poolId: { type: mongoose.Schema.Types.ObjectId, ref: 'CountryCurrencyPool', default: null },

    status: { type: String, enum: ['settled'], default: 'settled' },

    idempotencyKey: { type: String, required: true, trim: true },

    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true, index: true },
  },
  { timestamps: true }
);

geuRedemptionSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
geuRedemptionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('GeuRedemption', geuRedemptionSchema);
