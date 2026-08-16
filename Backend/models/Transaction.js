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
      // The three coin types are distinct from 'send' on purpose. A mint and a
      // redeem have one party, not two, and their fromUserId/toUserId would be
      // the same account — recording them as a 'send' would put a self-transfer
      // in the history of an API that rejects self-transfers everywhere else.
      // 'coin_send' is a real two-party movement but in coin units, so a
      // history reader that sums 'send' amounts as fiat must not pick it up.
      enum: [
        'send',
        'receive',
        'request',
        'qr_payment',
        'refund',
        'reversal',
        'coin_mint',
        'coin_redeem',
        'coin_send',
        // The second leg of a merchant-share payment (lib/merchantShareFlow.js):
        // records that a slice of a 'send' was diverted into the payer's
        // AssetSeed rather than paid to the merchant. fromUserId is the
        // merchant (whose cut this represents), toUserId is the payer (who
        // the seed belongs to) — same direction AssetSeed.userId already
        // uses. Deliberately never moves User.balance: the value it
        // documents is the same value already reflected in the linked
        // AssetSeed, so crediting it again would be inventing money, not
        // recording it. See metadata.noBalanceMovement on rows of this type.
        'share',
      ],
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