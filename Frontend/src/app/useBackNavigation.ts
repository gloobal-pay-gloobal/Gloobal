// ---------------------------------------------------------------------------
// Wires a phone's hardware/gesture back button (and a desktop browser's
// Back button) to close whichever full-screen step/overlay is currently
// open, instead of leaving the PWA entirely — this app has no router-based
// history for its internal stage/overlay state (see App.tsx's routing
// comment), so by default a back gesture just navigates the browser away
// from the page. Call once per dismissible screen, passing whether it's
// currently open and the same onBack/onClose handler already wired to its
// in-app back button — this only adds a browser-history entry around that
// existing handler, it never changes what closing actually does.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from "react";

export function useBackNavigation(isOpen: boolean, onBack: () => void) {
  const closingViaPopStateRef = useRef(false);
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!isOpen) return undefined;

    window.history.pushState({ gloobalBackNav: true }, "");

    function handlePopState() {
      closingViaPopStateRef.current = true;
      onBackRef.current();
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      // Closed via an in-app action (not the phone's back gesture) — undo
      // the entry pushed above so it doesn't linger as a dead "ghost" step
      // that the next real back-press would silently swallow instead of
      // actually leaving this screen.
      if (!closingViaPopStateRef.current) {
        window.history.back();
      }
      closingViaPopStateRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
}
