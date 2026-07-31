const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: ''
  },
  mobileNumber: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    default: null
  },
  symbolId: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  // Every Gloobal ID this account has ever had, with the moment it came in
  // or was replaced. The ID is the identity every other route keys off, so
  // a rename has to leave a dated record rather than silently overwriting
  // the old one — and the *first* ID has to be in that record too, or the
  // trail starts mid-story.
  //
  // `createdAt` is the timestamp field; `changedAt` is its predecessor,
  // written alongside it so documents saved by this version stay readable
  // to a client built before it. Full datetime, not a date — two renames a
  // minute apart are otherwise indistinguishable.
  symbolIdHistory: [{
    symbolId: {
      type: String,
      required: true
    },
    action: {
      type: String,
      enum: ['created', 'changed'],
      default: 'changed'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    changedAt: {
      type: Date,
      default: Date.now
    },
    replacedBy: {
      type: String,
      default: null
    }
  }],
  // Gloobal Creators choose for themselves what share of an incoming payment
  // they give back to whoever paid them — 0% to 7%, stored as a decimal
  // (1% = 0.01). This is the rate applied to the asset seed planted for the
  // payer; Gloobal does not set it centrally. A plain (non-Creator) account
  // simply leaves it at 0, which plants no seed.
  cashbackRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 0.07
  },
  // The account's Gloobal bank balance. Prototype money: every account opens
  // with the same test float so payment flows can actually be driven end to
  // end, instead of the dashboard showing one hardcoded string that no
  // transaction ever changed. No real money is represented here.
  balance: {
    type: Number,
    default: 10000,
    min: 0
  },
  // The direct person who invited them
  referredBy: {
    type: String,
    default: null
  },
  // NEW: The complete history of who invited who [Parent, Grandparent, Great-Grandparent]
  referralChain: {
    type: Array,
    default: []
  },
  referralCount: {
    type: Number,
    default: 0
  },
  passkeys: [{
    id: {
      type: String,
      required: true
    },
    publicKey: {
      type: Buffer,
      required: true
    },
    counter: {
      type: Number,
      default: 0
    },
    transports: {
      type: [String],
      default: []
    },
    deviceType: {
      type: String,
      default: null
    },
    backedUp: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  currentChallenge: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);