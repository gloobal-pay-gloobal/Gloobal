// Copies the face-recognition weights out of node_modules and into public/.
//
// They have to be served from our own origin — the app ships a strict
// `default-src 'self'` CSP, so the library's default CDN model path is
// blocked outright.
//
// They are copied rather than committed. The six models are ~13MB of binary
// weights; checking them in would bloat every clone and every diff forever,
// to store bytes that already arrive with `npm install`. public/models/ is
// gitignored and rebuilt here instead.
//
// Only the six models this app actually uses are copied. The package ships
// 27.7MB including hand tracking, pose and emotion, none of which face
// verification touches.
import { copyFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "node_modules", "@vladmandic", "human", "models");
const DEST = join(ROOT, "public", "models", "human");

const MODELS = [
  "blazeface", // face detection
  "facemesh", // 468-point mesh
  "iris", // eyelid + iris landmarks, what the blink check measures
  "faceres", // the descriptor/embedding
  "antispoof", // print/screen classifier
  "liveness", // replayed-video classifier
];

function main() {
  if (!existsSync(SRC)) {
    // Not fatal. A CI job that only lints, or an install that skipped
    // optional deps, should not fail the whole build over this — the Face ID
    // screen degrades to "could not start on this device" and every other
    // route still works.
    console.warn(`[copy-face-models] "${SRC}" not found — skipping. Face ID will be unavailable.`);
    return;
  }

  mkdirSync(DEST, { recursive: true });

  let copied = 0;
  let bytes = 0;
  for (const model of MODELS) {
    for (const ext of ["json", "bin"]) {
      const from = join(SRC, `${model}.${ext}`);
      const to = join(DEST, `${model}.${ext}`);
      if (!existsSync(from)) {
        console.warn(`[copy-face-models] missing ${model}.${ext}`);
        continue;
      }
      copyFileSync(from, to);
      bytes += statSync(to).size;
      copied += 1;
    }
  }

  console.log(
    `[copy-face-models] ${copied} files (${(bytes / 1024 / 1024).toFixed(1)} MB) -> public/models/human/`
  );
}

main();
