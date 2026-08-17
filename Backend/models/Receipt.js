const mongoose = require('mongoose');

// Stage 4 of the multi-currency/merchant-share architecture (Stage 1 was
// schema, Stage 2/3 were live FX + settlement). The diagrams describe a
// plain send as "1 transaction ID, 1 receipt" and a merchant-share payment
// as "2 transaction IDs, 4 receipts" — this model is the receipt half of
// that. See lib/merchantShareFlow.js for what actually issues these.
//
// A plain send gets one 'shared' receipt against its one Transaction — a
// single history record, not owned by either party specifically. A
// merchant-share payment produces two Transactions (the payment leg and the
// share leg — see Transaction.js's 'share' type comment for what the second
// one means) and each gets its own payer-copy/payee-copy pair, the same way
// a retail sale produces a customer receipt and a merchant/accounting copy
// — four receipts total, not because the same event is being recorded four
// times, but because two distinct events (payment, share) each get a
// two-sided record.
const ReceiptSchema = new mongoose.Schema({
  receiptId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    required: true,
    index: true,
  },
  // Which of the (up to two) transactions in the flow this receipt
  // documents. 'payment' is always present; 'share' only exists on a
  // merchant-share payment's second pair.
  leg: {
    type: String,
    enum: ['payment', 'share'],
    required: true,
  },
  // 'shared' = the plain-send case, one receipt for the one Transaction,
  // not held by a specific party. 'payer' / 'payee' = one copy each, only
  // used on a merchant-share payment's two receipt pairs.
  role: {
    type: String,
    enum: ['shared', 'payer', 'payee'],
    required: true,
  },
  // Whose copy this is. Null only when role is 'shared'.
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  counterpartyUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  currency: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
  },
  note: {
    type: String,
    trim: true,
    default: '',
    maxlength: 200,
  },
  issuedAt: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

ReceiptSchema.index({ transactionId: 1, role: 1 });
ReceiptSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Receipt', ReceiptSchema);
