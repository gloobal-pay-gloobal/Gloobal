const mongoose = require('mongoose');

// One row per "this account tapped I am IN on that product".
//
// The Gloobal Bank and Gloobal Coin screens each carry an "I am IN" button
// and an interest counter. Both used to be local component state in the
// app: the button forgot it had been pressed on the next reload, the count
// was `interested ? 1 : 0` out of a hardcoded "1 active user", and nothing
// about either ever reached a server. So the one thing those screens exist
// to do — find out how many people actually want the product before it is
// built — collected nothing.
//
// This is that signal, stored. Written by POST /api/interest, read back by
// GET /api/interest/:product and GET /api/interest/status/:symbolId.
const InterestSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Denormalised so the counts can be served without a join, and so a row
  // still says who it came from if the account is later renamed.
  symbolId: { type: String, required: true },
  product: { type: String, enum: ['bank', 'coin'], required: true }
}, { timestamps: true });

// The whole point of the counter is that it counts PEOPLE, not taps. A
// unique compound index makes a second "I am IN" from the same account a
// no-op at the database level rather than something the route has to
// remember to guard — double-tapping, or tapping again from a second
// device, can never inflate the figure.
InterestSchema.index({ symbolId: 1, product: 1 }, { unique: true });
InterestSchema.index({ product: 1 });

module.exports = mongoose.model('Interest', InterestSchema);
