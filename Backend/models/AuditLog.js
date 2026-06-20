const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    status: {
      type: String,
      enum: ['success', 'failed', 'blocked', 'info'],
      default: 'info',
      index: true,
    },

    message: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },

    ipAddress: {
      type: String,
      trim: true,
      default: '',
    },

    userAgent: {
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

auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);