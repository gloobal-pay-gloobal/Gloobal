const mongoose = require('mongoose');

// The "4. CURRENCY MASTER" table from the architecture diagrams: one row
// per currency any country's local currency resolves to. Populated from
// data/countryCurrencyMap.js's buildCurrencyMaster() — 142 rows for the
// 194-country list, since several countries share a currency (the
// Eurozone, the CFA franc zones, the East Caribbean dollar, and a few
// dollar/peg arrangements).
//
// `decimals` exists so an amount is never displayed or stored with more
// precision than the currency actually has — JPY, KRW, VND, the CFA francs
// and a handful of others have no minor unit, and inventing one would be
// exactly the kind of fabricated precision this codebase's provenance and
// receipt code goes out of its way to avoid elsewhere.
const CurrencySchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    minlength: 3,
    maxlength: 3
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  symbol: {
    type: String,
    required: true,
    trim: true
  },
  decimals: {
    type: Number,
    required: true,
    min: 0,
    max: 4
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, { timestamps: true });

module.exports = mongoose.model('Currency', CurrencySchema);
