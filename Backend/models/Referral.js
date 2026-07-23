const mongoose = require('mongoose');

// One row per "this person joined because that person shared their Gloobal
// ID". Written at registration time and read back by
// GET /api/referrals/:symbolId, which is what My Referral Network in the
// app renders — the referredBy/referralChain fields on User stay as they
// were, this is the queryable edge list beside them.
const ReferralSchema = new mongoose.Schema({
  referrerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referredId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  referrerSymbolId: { type: String, required: true },
  referredSymbolId: { type: String, required: true },
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' }
}, { timestamps: true });

ReferralSchema.index({ referrerId: 1 });
// A new account can only ever have been referred by one person.
ReferralSchema.index({ referredId: 1 }, { unique: true });

module.exports = mongoose.model('Referral', ReferralSchema);
