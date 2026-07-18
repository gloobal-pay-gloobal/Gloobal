// Hides the inline splash screen defined in index.html. Kept as its own
// tiny module (not inlined in index.html) because a `script-src 'self'`
// CSP — which this app sets, see index.html's meta tag — blocks inline
// <script> tags by design; only same-origin script *files* like this one
// are allowed to run. An earlier version of this lived as an inline
// script and was silently never executing under that CSP, which left the
// splash screen stuck on screen permanently.
export function hideSplash() {
  const el = document.getElementById("splash");
  if (!el) return;
  el.classList.add("hide");
  setTimeout(() => el.remove(), 300);
}

// Safety net: if something goes wrong before AppRoot's own effect calls
// hideSplash() (e.g. a render error), don't leave the splash up forever.
// This runs as soon as this module is evaluated — independent of whether
// the React tree itself ever successfully mounts.
if (typeof window !== "undefined") {
  setTimeout(hideSplash, 6000);
}
