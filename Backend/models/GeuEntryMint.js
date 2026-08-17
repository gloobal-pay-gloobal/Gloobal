const mongoose = require('mongoose');

// One row per capital-entry mint (GEU brief section 3/4) — the ONLY GEU
// creation reason that is backed by qualifying capital rather than a growth
// rule. Kept as its own collection, not folded into GeuGrowthEvent or a
// generic "GeuEvent" type: section 7 of the brief is explicit that entry
// and growth "must never be merged," and giving them separate schemas
// (rather than one schema with a `reason` enum) makes that structurally
// true rather than a convention a future write could violate.
const geuEntryMintSchema = new mongoose.Schema(
  {
    entryId: { type: String, required: true, unique: true, trim: true },

    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    symbolId: { type: String, required: true, index: true },

    // What the user actually paid in — their own currency, per brief
    // section 4. Derived from the account's own Country.localCurrency, the
    // same never-trust-the-client-for-currency rule
    // POST /api/transactions/send already follows (see AUDIT_REPORT.md's
    // Bugs Found #6) — never accepted as a raw client-supplied code.
    sourceCurrency: { type: String, required: true, trim: true, uppercase: true },
    sourceAmount: { type: Number, required: true, min: 0 },

    // The reference layer GEU is minted against — always INR today (brief
    // section 1: "1 GEU = ₹1"). Kept as an explicit field, not a hardcoded
    // constant read at call sites, so a row is self-describing if the
    // reference currency itself is ever revisited (a decision this
    // implementation does not make — see UNRESOLVED GEU POLICY QUESTIONS).
    referenceCurrency: { type: String, required: true, trim: true, uppercase: true, default: 'INR' },
    referenceAmount: { type: Number, required: true, min: 0 },

    // 1 for a same-currency (INR) entry. For a foreign-currency entry, the
    // exact rate captured via lib/fxRates.js#getRate at mint time — never
    // recalculated afterward (brief section 4's own explicit requirement,
    // and the same Invariant D the existing cross-border payment flow
    // already upholds — see AUDIT_TRACE.md).
    exchangeRate: { type: Number, required: true, min: 0 },
    rateSource: { type: String, default: 'identity', trim: true },
    rateTimestamp: { type: Date, required: true },

    geuAmount: { type: Number, required: true, min: 0 },

    // The Transaction row this entry is recorded against (type:
    // 'geu_entry_mint') — every GEU creation event traces back to one, the
    // same way a Coin mint does (see CoinReserve.js's own header comment).
    transactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', required: true, index: true },

    // Client-supplied, required — the idempotency key a capital-entry
    // request is deduplicated against (see the unique index below). Unlike
    // a payment retry (which has an existing Transaction to fall back to
    // detecting a duplicate against), a capital entry has no prior state to
    // compare against, so there is no equivalent of /transactions/send's
    // 15-second heuristic window here — only an explicit key.
    idempotencyKey: { type: String, required: true, trim: true },

    status: { type: String, enum: ['completed'], default: 'completed' },
  },
  { timestamps: true }
);

geuEntryMintSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
geuEntryMintSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('GeuEntryMint', geuEntryMintSchema);
