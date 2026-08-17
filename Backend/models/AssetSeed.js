const mongoose = require('mongoose');

// One "seed" per business/bill payment that earned cashback.
//
// The cashback itself is real money: it is credited straight into the
// payer's spendable balance at payment time (see server.js's
// performTransfer), the same moment this seed is planted. This record is
// not what makes the cashback spendable — it already is. What this record
// tracks is a *separate bonus on top*: for as long as a seed's cashback
// goes unclaimed as interest, it keeps earning 1%/month, compounded, and
// that bonus can be pulled into real balance at any time via
// POST /api/assets/claim-interest.
//
// cashback/plantedAt are immutable and never drift — a seed's accrued
// interest is always a pure function of time, derived on read
// (see computeSeed). interestClaimed is the only mutable field: it only
// ever increases, by however much of that accrued interest has actually
// been paid out to balance so far.
const AssetSeedSchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  symbolId:        { type: String, required: true },          // owner's Gloobal ID
  business:        { type: String, required: true },          // business name
  category:        { type: String, default: 'General' },      // chip/tag
  amountPaid:      { type: Number, required: true },          // original payment amount
  cashbackRate:    { type: Number, required: true },          // e.g. 0.01 = 1%
  cashback:        { type: Number, required: true },          // amountPaid × cashbackRate — already credited to balance
  plantedAt:       { type: Date, default: Date.now },         // when seed was created
  currency:        { type: String, default: 'INR' },
  interestClaimed: { type: Number, default: 0 },              // bonus interest already paid out to balance
  lastClaimedAt:   { type: Date, default: null },
  // Audit fix: the payment this seed documents. Added because nothing
  // previously linked a seed back to a real Transaction — every seed's
  // amountPaid/cashbackRate/cashback were trusted numbers with no way to
  // verify a real payment ever produced them (see server.js's
  // POST /api/assets/plant-seed, which used to accept these figures
  // straight from the client). Null only for seeds planted before this
  // field existed; every seed created from now on carries it, and the
  // unique index below guarantees a given payment can only ever plant one.
  transactionId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction', default: null },
}, { timestamps: true });

AssetSeedSchema.index({ userId: 1 });
AssetSeedSchema.index({ symbolId: 1 });
// Partial: only applies where transactionId is actually set, so the many
// pre-existing seeds with none (and any future manual/legacy row that
// genuinely has no transaction to reference) are never compared against
// each other or blocked by this constraint — only real duplicate planting
// against the SAME transaction is.
AssetSeedSchema.index(
  { transactionId: 1 },
  { unique: true, partialFilterExpression: { transactionId: { $type: 'objectId' } } }
);

module.exports = mongoose.model('AssetSeed', AssetSeedSchema);
