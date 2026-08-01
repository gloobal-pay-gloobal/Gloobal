// Descriptor comparison.
//
// Two descriptors are only comparable when they came from the same model at
// the same version — embeddings from different networks share no coordinate
// system, and comparing across them produces confident nonsense rather than
// an error. Hence the model tag stored alongside every template.
//
// The comparison runs here, on the server, and never in the browser. The
// client computes a descriptor from camera frames; letting it also decide
// "this matched" would mean trusting the caller to grade its own exam.
// Server-side scoring does not make this strong on its own — a modified
// client can still post a descriptor it obtained elsewhere — which is why
// face verification is an additional factor here and never replaces the
// passkey or the PIN.

const DEFAULT_MATCH_THRESHOLD = 0.86;

/** Cosine similarity in [-1, 1]; 1 is identical direction. */
function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) {
    throw new Error('Descriptors must be non-empty arrays of equal length.');
  }
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  // A zero-magnitude descriptor is a broken capture, not a match against
  // everything. Report no similarity rather than dividing by zero.
  if (!denom) return 0;
  return dot / denom;
}

/** Euclidean distance — reported for observability, not used for the decision. */
function euclideanDistance(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) {
    throw new Error('Descriptors must be non-empty arrays of equal length.');
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * The configured decision threshold.
 *
 * This is the false-accept / false-reject dial and it is a product decision,
 * not a constant to tune until the demo passes. Lower it and strangers start
 * getting in; raise it and real owners get locked out in bad light. The
 * default is deliberately strict because this factor sits alongside a
 * passkey — a rejected owner has another way in, an accepted stranger does
 * not have another gate to fail.
 */
function matchThreshold() {
  const raw = Number(process.env.FACE_MATCH_THRESHOLD);
  if (Number.isFinite(raw) && raw > 0 && raw <= 1) return raw;
  return DEFAULT_MATCH_THRESHOLD;
}

/**
 * Compares a freshly captured descriptor against the enrolled one.
 * Returns { matched, similarity, distance, threshold }.
 */
function compareDescriptors(candidate, enrolled, threshold = matchThreshold()) {
  const similarity = cosineSimilarity(candidate, enrolled);
  return {
    matched: similarity >= threshold,
    similarity: Number(similarity.toFixed(6)),
    distance: Number(euclideanDistance(candidate, enrolled).toFixed(6)),
    threshold,
  };
}

module.exports = {
  cosineSimilarity,
  euclideanDistance,
  compareDescriptors,
  matchThreshold,
  DEFAULT_MATCH_THRESHOLD,
};
