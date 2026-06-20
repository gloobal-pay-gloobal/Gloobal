const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    currency: {
      type: String,
      default: 'INR',
      trim: true,
      uppercase: true,
    },

    type: {
      type: String,
      enum: ['send', 'receive', 'request', 'qr_payment', 'refund', 'reversal'],
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ['created', 'pending', 'success', 'failed', 'cancelled', 'refunded', 'reversed'],
      default: 'created',
      index: true,
    },

    note: {
      type: String,
      trim: true,
      default: '',
      maxlength: 200,
    },

    referenceId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    failureReason: {
      type: String,
      trim: true,
      default: '',
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

transactionSchema.index({ fromUserId: 1, createdAt: -1 });
transactionSchema.index({ toUserId: 1, createdAt: -1 });
transactionSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);