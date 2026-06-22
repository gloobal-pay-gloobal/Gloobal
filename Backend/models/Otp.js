const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    mobileNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    otpHash: {
      type: String,
      required: true,
      trim: true,
    },

    purpose: {
      type: String,
      enum: ['registration', 'login', 'pin_reset', 'mobile_change'],
      default: 'registration',
      index: true,
    },

    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },

    maxAttempts: {
      type: Number,
      default: 5,
      min: 1,
    },

    expiresAt: {
      type: Date,
      required: true,
    },

    verifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

otpSchema.index({ mobileNumber: 1, purpose: 1, createdAt: -1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Otp', otpSchema);