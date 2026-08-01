const mongoose = require('mongoose');

// One enrolled face per account.
//
// What is stored is a descriptor — a vector of floats produced by the
// browser's model — encrypted with AES-256-GCM (see lib/faceCrypto.js).
// What is NOT stored, anywhere, at any point: the captured frames. The
// image is used to compute the descriptor in the browser and then discarded;
// it is never uploaded, never logged, never written to disk.
//
// `model` pins which network produced the vector. Descriptors from different
// models are not comparable, so a model upgrade invalidates every template
// and forces re-enrolment rather than silently scoring garbage.
const faceTemplateSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    // --- AES-256-GCM envelope -------------------------------------------
    ciphertext: {
      type: String,
      required: true,
    },

    iv: {
      type: String,
      required: true,
    },

    authTag: {
      type: String,
      required: true,
    },

    // --- Provenance ------------------------------------------------------
    // Which model+version produced this descriptor. Compared on every
    // verify; a mismatch is an error, never a "no match".
    model: {
      type: String,
      required: true,
      trim: true,
    },

    dimensions: {
      type: Number,
      required: true,
      min: 1,
    },

    // Whether the enrolling capture passed the blink/liveness gate. An
    // enrolment taken from a still photo would otherwise become the
    // reference every later check is measured against.
    livenessPassed: {
      type: Boolean,
      default: false,
    },

    // --- Verification bookkeeping (mirrors Pin) --------------------------
    // Biometrics need a lockout as much as PINs do. Without one, a
    // descriptor can be brute-forced offline against the threshold by
    // replaying slight variations until one lands.
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

    enrolledAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

faceTemplateSchema.index({ userId: 1, lockedUntil: 1 });

// The encrypted material must never reach a response body, a log line, or a
// JSON.stringify of a Mongoose document. Stripping it in toJSON/toObject is
// the backstop for the routes forgetting to project it away.
function stripSecrets(_doc, ret) {
  delete ret.ciphertext;
  delete ret.iv;
  delete ret.authTag;
  return ret;
}

faceTemplateSchema.set('toJSON', { transform: stripSecrets });
faceTemplateSchema.set('toObject', { transform: stripSecrets });

module.exports = mongoose.model('FaceTemplate', faceTemplateSchema);
