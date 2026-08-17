const mongoose = require('mongoose');

// One row per country in the frontend's registration picker — same 194
// entries as Frontend's backend/data/countries.js, same ISO codes, same
// flags (the flag is derived from `iso` on the client, not stored twice
// here). This is the "3. COUNTRIES" table the architecture diagrams
// describe; before this it existed only as static frontend display data
// with no backend row to hang a currency pool off of.
//
// `localCurrency` is what makes a country's own pool set meaningful — it's
// the currency every one of that country's CountryCurrencyPool documents
// is denominated in (see CountryCurrencyPool.js). Sourced from
// data/countryCurrencyMap.js, itself standard ISO 3166/4217 reference data.
const CountrySchema = new mongoose.Schema({
  iso: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    minlength: 2,
    maxlength: 2
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  dialCode: {
    type: String,
    required: true,
    trim: true
  },
  localCurrency: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },
  // A country can exist for display (it's in the registration picker)
  // before it's allowed to hold real pool balances — mirrors the
  // live/planned split Product.js already uses for bank vs coin, applied
  // here to "can this country actually settle" instead of "does this
  // product work".
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, { timestamps: true });

CountrySchema.index({ localCurrency: 1 });

module.exports = mongoose.model('Country', CountrySchema);
