const mongoose = require('mongoose');

// The fiat sitting behind Gloobal Coin, and the coin issued against it.
//
// Gloobal Coin is fully backed: a coin only comes into existence when the same
// amount of prototype fiat is moved out of an account and into this reserve,
// and it only leaves existence when that fiat is handed back. There is no
// other way to obtain one. That makes "Backed" a fact the database can be
// asked about rather than a claim on a marketing screen.
//
// Both figures are stored even though either could be derived from the other,
// and that redundancy is the point. `reserve` and `issued` are incremented by
// separate lines of the same update; `sum(User.coinBalance)` is maintained by a
// third. Three numbers that are only equal because every mint, redeem and
// transfer kept them equal is a far stronger statement than one number that is
// trivially equal to itself — a mint that moved fiat but forgot to issue, or a
// transfer that credited without debiting, shows up immediately as a mismatch.
// tests/coin-supply-invariant.test.mjs asserts all three agree.
//
// A singleton: one document, found by `key`. Mongoose has no notion of a
// single-row collection, so the key is unique-indexed and every read goes
// through loadCoinReserve() below rather than findOne() at the call site.
const coinReserveSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'global',
    },

    // Prototype fiat held in trust against issued coin. Never negative: a
    // redeem that would take it below zero is a redeem of coin that was never
    // minted, which is the failure this bound exists to make impossible.
    reserve: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Coin in circulation, summed across every account. Equal to `reserve` at
    // rest, and equal to it after every committed operation.
    issued: {
      type: Number,
      default: 0,
      min: 0,
    },

    // What the reserve is denominated in. Coin is issued 1:1 against it, so
    // this is also the redemption currency.
    reserveCurrency: {
      type: String,
      default: 'INR',
      trim: true,
      uppercase: true,
    },
  },
  {
    timestamps: true,
  }
);

const CoinReserve = mongoose.model('CoinReserve', coinReserveSchema);

// Returns the singleton, creating it on first use.
//
// upsert rather than "find, and create if missing": two requests arriving
// together would both find nothing and both insert, and the unique index would
// turn the loser into a 500 on what is a read. `$setOnInsert` means an existing
// document is never touched — this is safe to call on every coin request.
CoinReserve.load = async function loadCoinReserve(session) {
  const options = { upsert: true, returnDocument: 'after', ...(session ? { session } : {}) };

  return CoinReserve.findOneAndUpdate(
    { key: 'global' },
    { $setOnInsert: { reserve: 0, issued: 0, reserveCurrency: 'INR' } },
    options
  );
};

module.exports = CoinReserve;
