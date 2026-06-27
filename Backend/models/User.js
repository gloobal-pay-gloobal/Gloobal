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