// Face detection, liveness and descriptor extraction — all in the browser.
//
// Nothing here uploads an image. Frames are read from the <video> element,
// turned into a descriptor, and dropped. The descriptor is the only thing
// that ever leaves the device (see services/api/faceApi.js), and it is
// encrypted before it is written to Mongo.
//
// Models are served from /models/human/ on our own origin, not a CDN: the
// app ships a strict `default-src 'self'` CSP, and a CDN model path would be
// blocked. They are ~13 MB, so this module is imported lazily by the Face ID
// screen and never by the main bundle.

const MODEL_BASE_PATH = "/models/human/";

// Pinned model identity, stored beside every enrolled template. Descriptors
// from different models share no coordinate system, so bumping this on a
// model change is what forces re-enrolment instead of silently scoring two
// incompatible vectors against each other.
export const FACE_MODEL_TAG = "human-faceres-v3";

// --- Liveness thresholds ---------------------------------------------------
// Eye Aspect Ratio: the eye's vertical opening over its width. An open eye
// sits around 0.28-0.35, a closed one near 0.10. A blink is a dip below
// EAR_CLOSED followed by a recovery above EAR_OPEN — requiring both halves
// is what separates a real blink from a photo of someone mid-blink, or from
// the detector simply losing the eye for a frame.
export const EAR_CLOSED = 0.18;
export const EAR_OPEN = 0.26;

// Anti-spoof and liveness are small classifiers that flag replayed video and
// printed/screen faces. They are a cheap extra signal, not a guarantee, so
// the blink challenge is still required on top.
const MIN_REAL_SCORE = 0.5;
const MIN_LIVE_SCORE = 0.5;
const MIN_FACE_SCORE = 0.5;

let humanPromise = null;

/**
 * Loads the engine once. Kept as a promise rather than a boolean so that two
 * screens mounting at the same time share a single ~13 MB load instead of
 * racing two.
 */
export async function loadFaceEngine() {
  if (humanPromise) return humanPromise;

  humanPromise = (async () => {
    const { default: Human } = await import("@vladmandic/human");
    const human = new Human({
      // WebGL rather than the WASM backend on purpose: the WASM path needs
      // 'wasm-unsafe-eval' in script-src, and widening the CSP for a single
      // feature is a worse trade than using the backend that already works
      // under it.
      backend: "webgl",
      modelBasePath: MODEL_BASE_PATH,
      // Every frame is judged on its own. Cached results would let a single
      // good frame keep satisfying the liveness check after the real face
      // had left.
      cacheSensitivity: 0,
      warmup: "none",
      face: {
        enabled: true,
        detector: { modelPath: "blazeface.json", maxDetected: 1, rotation: false },
        mesh: { enabled: true, modelPath: "facemesh.json" },
        // The iris model is what gives eyelid and iris landmarks precise
        // enough for a blink to be measurable.
        iris: { enabled: true, modelPath: "iris.json" },
        description: { enabled: true, modelPath: "faceres.json" },
        antispoof: { enabled: true, modelPath: "antispoof.json" },
        liveness: { enabled: true, modelPath: "liveness.json" },
        emotion: { enabled: false },
      },
      body: { enabled: false },
      hand: { enabled: false },
      object: { enabled: false },
      gesture: { enabled: false },
      segmentation: { enabled: false },
    });

    await human.load();
    return human;
  })();

  return humanPromise;
}

/** Euclidean length between two [x, y, z?] landmarks, in 2D. */
function dist(a, b) {
  if (!a || !b) return 0;
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Eye Aspect Ratio from the mesh's eyelid contours.
 *
 * Averaged across three sample points rather than measured at one, because a
 * single vertical pair sits right where the mesh is least stable and produces
 * phantom blinks on head movement alone.
 */
export function eyeAspectRatio(upper, lower, corners) {
  if (!Array.isArray(upper) || !Array.isArray(lower) || upper.length < 5 || lower.length < 5) {
    return null;
  }
  const width = corners ? dist(corners[0], corners[1]) : dist(upper[0], upper[upper.length - 1]);
  if (!width) return null;

  const picks = [Math.floor(upper.length * 0.25), Math.floor(upper.length * 0.5), Math.floor(upper.length * 0.75)];
  let total = 0;
  let counted = 0;
  for (const i of picks) {
    const u = upper[i];
    const l = lower[Math.min(i, lower.length - 1)];
    if (u && l) {
      total += dist(u, l);
      counted += 1;
    }
  }
  if (!counted) return null;
  return total / counted / width;
}

/** Pulls both eyes' openness out of a human.js face result. */
function readEyes(face) {
  const a = face?.annotations || {};
  const left = eyeAspectRatio(a.leftEyeUpper0, a.leftEyeLower0, [
    a.leftEyeLower0?.[0],
    a.leftEyeLower0?.[a.leftEyeLower0.length - 1],
  ]);
  const right = eyeAspectRatio(a.rightEyeUpper0, a.rightEyeLower0, [
    a.rightEyeLower0?.[0],
    a.rightEyeLower0?.[a.rightEyeLower0.length - 1],
  ]);

  const values = [left, right].filter((v) => typeof v === "number" && Number.isFinite(v));
  return {
    left,
    right,
    // Both eyes averaged: winking is not a blink, and one eye occluded by
    // hair or a hand shouldn't read as closed.
    ear: values.length ? values.reduce((s, v) => s + v, 0) / values.length : null,
    irisFound: Boolean(a.leftEyeIris?.length && a.rightEyeIris?.length),
  };
}

/**
 * Runs one detection pass over a video element.
 *
 * Returns a plain, serialisable summary — never the raw tensors, and never
 * the frame itself.
 */
export async function detectFace(video) {
  const human = await loadFaceEngine();
  const result = await human.detect(video);
  const face = result?.face?.[0];

  if (!face || (face.score ?? 0) < MIN_FACE_SCORE) {
    return { found: false, reason: face ? "low_confidence" : "no_face" };
  }

  // human exposes the faceres output as `embedding` and, on some builds, as
  // `descriptor`. Read whichever is present rather than assuming.
  const raw = face.embedding || face.descriptor || null;
  const descriptor = Array.isArray(raw) ? Array.from(raw) : null;

  const eyes = readEyes(face);
  const real = typeof face.real === "number" ? face.real : null;
  const live = typeof face.live === "number" ? face.live : null;

  return {
    found: true,
    descriptor,
    score: face.score ?? null,
    box: face.box || null,
    eyes,
    real,
    live,
    // The classifiers' own verdict. The blink challenge is tracked separately
    // by the caller and both must pass.
    spoofSuspected: (real !== null && real < MIN_REAL_SCORE) || (live !== null && live < MIN_LIVE_SCORE),
  };
}

/**
 * Tracks a blink across frames.
 *
 * State machine rather than a single threshold test: the eye has to be seen
 * open, then closed, then open again. A still photograph never produces that
 * sequence no matter how long it is held up.
 */
export function createBlinkDetector() {
  let sawOpen = false;
  let sawClosed = false;
  let blinks = 0;

  return {
    /** Feed each frame's EAR. Returns true once a full blink has completed. */
    push(ear) {
      if (typeof ear !== "number" || !Number.isFinite(ear)) return false;
      if (ear >= EAR_OPEN) {
        if (sawOpen && sawClosed) {
          blinks += 1;
          sawClosed = false;
          return true;
        }
        sawOpen = true;
      } else if (ear <= EAR_CLOSED && sawOpen) {
        sawClosed = true;
      }
      return false;
    },
    get blinks() {
      return blinks;
    },
    reset() {
      sawOpen = false;
      sawClosed = false;
      blinks = 0;
    },
  };
}
