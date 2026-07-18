// Runs after `vite build` (see the "build" script in package.json).
//
// Vite's production output uses content-hashed filenames (e.g.
// assets/index-a1b2c3d4.js) so browsers can cache them forever — but that
// means a hand-written service worker can't know the exact filenames to
// precache ahead of time. This script closes that gap without pulling in
// a bundler plugin: it reads dist/ after the build, and rewrites the
// sw.js that Vite already copied there (from public/sw.js) so its
// APP_SHELL list includes every real hashed asset, and its CACHE_VERSION
// is a hash of that same file list — so the version only changes when the
// build output actually changes, which is exactly when clients should
// pick up an update.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, extname, sep } from "node:path";
import { createHash } from "node:crypto";

const DIST_DIR = "dist";
const SW_PATH = join(DIST_DIR, "sw.js");

const PRECACHE_EXTENSIONS = new Set([
  ".js", ".css", ".mjs", ".html",
  ".png", ".jpg", ".jpeg", ".svg", ".webp", ".avif",
  ".woff", ".woff2", ".ttf", ".ico",
]);

// Files that are either already listed by hand in sw.js, or shouldn't
// ever be precached (the service worker script itself).
const SKIP = new Set(["sw.js"]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else {
      out.push(full);
    }
  }
  return out;
}

function main() {
  let files;
  try {
    files = walk(DIST_DIR);
  } catch (err) {
    console.error(`[generate-sw] Could not read "${DIST_DIR}" — did the Vite build run first?`, err.message);
    process.exit(1);
  }

  const manifestEntries = [];
  for (const file of files) {
    const rel = relative(DIST_DIR, file).split(sep);
    const urlPath = "/" + rel.join("/");
    const name = rel[rel.length - 1];
    if (SKIP.has(name)) continue;
    if (!PRECACHE_EXTENSIONS.has(extname(name))) continue;
    manifestEntries.push(urlPath);
  }

  let swSource;
  try {
    swSource = readFileSync(SW_PATH, "utf8");
  } catch (err) {
    console.error(`[generate-sw] Could not read "${SW_PATH}" — is sw.js in public/?`, err.message);
    process.exit(1);
  }

  const existingEntries = new Set(
    Array.from(swSource.matchAll(/"(\/[^"]*)"/g)).map((m) => m[1])
  );
  const newEntries = manifestEntries.filter((p) => !existingEntries.has(p));

  const manifestLines = newEntries.map((p) => `  ${JSON.stringify(p)},`).join("\n");
  const injected = swSource.replace(
    "/* __BUILD_PRECACHE_MANIFEST__ */",
    manifestLines
  );

  const versionSource = manifestEntries.slice().sort().join("|");
  const version = createHash("sha256").update(versionSource).digest("hex").slice(0, 10);
  const versioned = injected.replace("__CACHE_VERSION__", version);

  writeFileSync(SW_PATH, versioned, "utf8");
  console.log(`[generate-sw] Precached ${newEntries.length} additional build assets (${existingEntries.size} already listed) into dist/sw.js — cache version ${version}.`);
}

main();
