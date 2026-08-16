const mongoose = require('mongoose');

// The "6. EXCHANGE RATES" table — a cache of live-fetched rates, not a
// manually maintained one. Every row is written by lib/fxRates.js after a
// real fetch from the configured provider (see that file for which one and
// why); nothing here is hand-entered.
//
// Keyed by (fromCurrency, toCurrency) with the newest fetch overwriting the
// row rather than accumulating history, because the settlement engine only
// ever wants "the current rate" and a growing table of every fetch since
// launch is a cost with no reader. `fetchedAt` is what makes a row
// answerable as "fresh enough to trust" or "stale, refetch before using" —
// see FX_RATE_MAX_AGE_MS in lib/fxRates.js for the actual threshold.
//
// `source` records which provider answered, so a rate that turns out wrong
// is traceable to where it came from rather than treated as ambient truth.
const ExchangeRateSchema = new mongoose.Schema({
  fromCurrency: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  toCurrency: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  rate: {
    type: Number,
    required: true,
    min: 0
  },
  source: {
    type: String,
    required: true,
    trim: true
  },
  fetchedAt: {
    type: Date,
    required: true,
    default: Date.now
  }
}, { timestamps: true });

ExchangeRateSchema.index({ fromCurrency: 1, toCurrency: 1 }, { unique: true });

module.exports = mongoose.model('ExchangeRate', ExchangeRateSchema);
