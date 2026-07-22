// Gmail-style "suggested addresses" for the Gloobal ID creation step.
//
// Popular, simple patterns (++++++++++++ and friends) get claimed fast, so
// when the availability check comes back TAKEN the person gets two nearby
// IDs they can adopt with one tap instead of guessing blindly.
//
// Everything here is frontend-only — no new backend endpoint. The
// suggestions are still run through the same availability check as a
// hand-typed ID, so a suggestion that has since been claimed is caught
// exactly like any other taken ID.

// The eight symbols the dial pad offers. A Gloobal ID is made of these and
// nothing else — notably NOT of digits, which is why both suggestion
// shapes below draw from this set rather than appending 0-9. A suggestion
// containing a digit could never be registered.
export const ID_SYMBOLS = ["−", "+", "×", "=", "○", "□", "●", "■"];

const pick = () => ID_SYMBOLS[Math.floor(Math.random() * ID_SYMBOLS.length)];

// Keeps an ID at exactly `length` characters by trimming from the START,
// so whichever symbols were just appended are the ones that survive.
function fitToLength(id, length) {
  return id.length > length ? id.slice(id.length - length) : id;
}

/**
 * Two suggestions derived from the ID the person actually attempted, so
 * they read as a near-miss of their own choice rather than random noise.
 *
 *   A — append two fresh symbols to the attempt (then trim to length)
 *   B — swap the attempt's last two symbols for two fresh ones
 *
 * Both are guaranteed to differ from each other and from the attempt.
 */
export function generateIdSuggestions(attempt, length = 12, count = 2) {
  const base = fitToLength(String(attempt || ""), length);
  const shapes = [
    () => fitToLength(base + pick() + pick(), length),
    () => fitToLength(base.slice(0, Math.max(0, base.length - 2)) + pick() + pick(), length),
  ];

  const out = [];
  for (let attempts = 0; out.length < count && attempts < 60; attempts++) {
    const candidate = shapes[out.length % shapes.length]();
    if (candidate === base || out.includes(candidate)) continue;
    out.push(candidate);
  }

  // Pathological fallback (the shapes kept colliding, e.g. a one-symbol
  // alphabet): a wholly random ID, so the panel never renders with fewer
  // pills than it promised.
  while (out.length < count) {
    let candidate = "";
    for (let i = 0; i < length; i++) candidate += pick();
    if (candidate !== base && !out.includes(candidate)) out.push(candidate);
  }

  return out;
}
