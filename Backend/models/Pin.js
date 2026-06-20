const mongoose = require('mongoose');

const pinSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    pinHash: {
      type: String,
      required: true,
      trim: true,
    },

    failedAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    lockedUntil: {
      type: Date,
      default: null,
    },

    lastVerifiedAt: {
      type: Date,
      default: null,
    },

    changedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

pinSchema.index({ userId: 1, lockedUntil: 1 });

module.exports = mongoose.model('Pin', pinSchema);