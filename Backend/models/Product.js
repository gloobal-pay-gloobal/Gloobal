const mongoose = require('mongoose');

// Whether a product actually works yet.
//
// Deliberately separate from "locked". Locked is a gate on the person —
// you cannot open this. Live is a fact about the product — this does not
// work. Gloobal Coin is the case that needs both: open to look at, and not
// built. Conflating them is what let Coin be described three different
// ways at once in the app (unlocked in one place, "isn't live yet" in the
// two toasts that reroute a Coin payment to Bank, and four ticked services
// on its own screen).
//
// It lives beside ProductService because the two are read together and are
// the same decision: a service cannot be live inside a product that isn't,
// and GET /api/products/:product enforces exactly that before answering.
const ProductSchema = new mongoose.Schema({
  key: { type: String, enum: ['bank', 'coin'], required: true, unique: true },
  live: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Product', ProductSchema);
