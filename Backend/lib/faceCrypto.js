// AES-256-GCM envelope for face descriptors.
//
// A face descriptor is not a password. A leaked password is rotated in a
// minute; a leaked face template is permanent, belongs to a person rather
// than an account, and recent work shows a recognisable face can be
// reconstructed from a descriptor alone. So the descriptor is never written
// to Mongo in the clear, and this module is the only place that can read it.
//
// Deliberately fails closed. If FACE_ENCRYPTION_KEY is missing or malformed
// the enrol/verify routes return 503 rather than falling back to plaintext —
// a misconfigured deploy must not quietly start storing biometrics
// unencrypted.
const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12; // 96-bit nonce, the GCM standard

class FaceCryptoUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FaceCryptoUnavailableError';
  }
}

/** Reads the key at call time, not at import time, so a test can set it. */
function readKey() {
  const raw = String(process.env.FACE_ENCRYPTION_KEY || '').trim();
  if (!raw) {
    throw new FaceCryptoUnavailableError(
      'FACE_ENCRYPTION_KEY is not set. Face verification is disabled until it is.'
    );
  }
  let key;
  try {
    key = Buffer.from(raw, 'hex');
  } catch {
    throw new FaceCryptoUnavailableError('FACE_ENCRYPTION_KEY is not valid hex.');
  }
  if (key.length !== KEY_BYTES) {
    throw new FaceCryptoUnavailableError(
      `FACE_ENCRYPTION_KEY must be ${KEY_BYTES} bytes (${KEY_BYTES * 2} hex chars); got ${key.length}.`
    );
  }
  return key;
}

/** True when a usable key is configured — lets routes answer 503 up front. */
function isConfigured() {
  try {
    readKey();
    return true;
  } catch {
    return false;
  }
}

/**
 * Encrypts a descriptor (array of finite numbers) into a stored envelope.
 * Float32 is what every browser model emits, so the values are packed as
 * a Float32Array rather than JSON text — four bytes per dimension instead
 * of ~20, and no float-to-string rounding.
 */
function encryptDescriptor(descriptor) {
  if (!Array.isArray(descriptor) || descriptor.length === 0) {
    throw new Error('Descriptor must be a non-empty array.');
  }
  if (!descriptor.every((n) => Number.isFinite(n))) {
    throw new Error('Descriptor must contain only finite numbers.');
  }

  const key = readKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const floats = Float32Array.from(descriptor);
  const plaintext = Buffer.from(floats.buffer, floats.byteOffset, floats.byteLength);

  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    dimensions: descriptor.length,
  };
}

/**
 * Reverses encryptDescriptor. GCM authentication means a tampered or
 * truncated record throws instead of returning a plausible-but-wrong
 * descriptor — which would otherwise read as "this face does not match."
 */
function decryptDescriptor(envelope) {
  const key = readKey();
  const iv = Buffer.from(envelope.iv, 'base64');
  const authTag = Buffer.from(envelope.authTag, 'base64');
  const ciphertext = Buffer.from(envelope.ciphertext, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  // Copy into a correctly-aligned buffer: Buffer.concat gives no guarantee
  // that byteOffset is a multiple of 4, and Float32Array demands it.
  const aligned = new ArrayBuffer(plaintext.byteLength);
  Buffer.from(aligned).set(plaintext);
  return Array.from(new Float32Array(aligned));
}

module.exports = {
  encryptDescriptor,
  decryptDescriptor,
  isConfigured,
  FaceCryptoUnavailableError,
};
