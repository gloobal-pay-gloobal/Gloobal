const mongoose = require('mongoose');

// The "11. settlements" table / the diagrams' "GLOBAL SETTLEMENT RECORD"
// step. One row per cross-currency transaction, recording the pair of
// CountryCurrencyPool movements that connected the sender's country to the
// receiver's country — see CountryCurrencyPool.js's header comment for what
// the two pool sides actually mean.
//
// This is the audit trail the diagrams promise ("Fully traceable with Txn
// ID", "Rate Snapshotted"): `rate` and `rateSource` are copied from the
// ExchangeRate row used at settlement time, not re-derived later, so a rate
// that moves tomorrow can never retroactively change what today's
// settlement is recorded as having used.
const SettlementSchema = new mongoose.Schema({
  settlementId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    required: true,
    index: true
  },

  sourceCountryIso: { type: String, required: true, uppercase: true, trim: true },
  sourceCurrency: { type: String, required: true, uppercase: true, trim: true },
  sourceAmount: { type: Number, required: true, min: 0 },
  sourcePoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'CountryCurrencyPool', required: true },

  destinationCountryIso: { type: String, required: true, uppercase: true, trim: true },
  destinationCurrency: { type: String, required: true, uppercase: true, trim: true },
  destinationAmount: { type: Number, required: true, min: 0 },
  destinationPoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'CountryCurrencyPool', required: true },

  // sourceCurrency -> destinationCurrency, as used for this settlement.
  // destinationAmount = sourceAmount * rate, computed once and stored, not
  // recomputed on read.
  rate: { type: Number, required: true, min: 0 },
  rateSource: { type: String, required: true, trim: true },

  status: {
    type: String,
    enum: ['pending', 'settled', 'failed'],
    default: 'pending',
    index: true
  },
  failureReason: { type: String, trim: true, default: '' },
  settledAt: { type: Date, default: null }
}, { timestamps: true });

SettlementSchema.index({ sourceCountryIso: 1, createdAt: -1 });
SettlementSchema.index({ destinationCountryIso: 1, createdAt: -1 });

module.exports = mongoose.model('Settlement', SettlementSchema);
