// Registers the hand-written service worker (public/sw.js) in production
// builds only — running it under `vite dev` tends to fight with Vite's own
// module HMR/caching, so it's skipped there.
//
// Update flow: when a new service worker finishes installing while an
// older one is already controlling the page, it parks itself in the
// "waiting" state instead of activating immediately — this is what makes
// updates silent (the current session is never interrupted mid-use).
// `onUpdateReady` fires once that new worker is ready, so the UI can offer
// a "restart to update" affordance instead of the app randomly reloading
// itself underneath the person using it.
export function registerServiceWorker(onUpdateReady) {
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          onUpdateReady && onUpdateReady(registration);
        }
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              onUpdateReady && onUpdateReady(registration);
            }
          });
        });
      })
      .catch((err) => {
        // Registration failures shouldn't break the app — it just runs
        // without offline support / installability that visit.
        console.warn("Service worker registration failed:", err);
      });

    // The waiting worker activates only once we tell it to (see
    // applyUpdate below); once it does, its controllerchange fires here —
    // reload then, exactly once, to pick up the new version.
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}

// Tells a waiting service worker to take over now. Call this from a user
// action (e.g. tapping "Update" on the update toast) — never automatically,
// so an update never interrupts something the person is in the middle of.
export function applyUpdate(registration) {
  if (!registration || !registration.waiting) return;
  registration.waiting.postMessage({ type: "SKIP_WAITING" });
}

