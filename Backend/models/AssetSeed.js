const mongoose = require('mongoose');

// One "seed" per business/bill payment that earned cashback. The cashback is
// planted at payment time and then grows on its own (1%/month, compounded)
// toward the original amount paid. Computed values (current value, time to
// target) are always derived on read from plantedAt — never stored — so a
// seed's value is a pure function of time and never drifts.
const AssetSeedSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  symbolId:     { type: String, required: true },          // owner's Gloobal ID
  business:     { type: String, required: true },          // business name
  category:     { type: String, default: 'General' },      // chip/tag
  amountPaid:   { type: Number, required: true },          // original payment amount
  cashbackRate: { type: Number, required: true },          // e.g. 0.01 = 1%
  cashback:     { type: Number, required: true },          // amountPaid × cashbackRate
  plantedAt:    { type: Date, default: Date.now },         // when seed was created
  currency:     { type: String, default: 'INR' },
}, { timestamps: true });

AssetSeedSchema.index({ userId: 1 });
AssetSeedSchema.index({ symbolId: 1 });

module.exports = mongoose.model('AssetSeed', AssetSeedSchema);
