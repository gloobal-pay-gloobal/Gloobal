// ---------------------------------------------------------------------------
// Wires a phone's hardware/gesture back button (and a desktop browser's
// Back button) to close whichever full-screen step/overlay is currently
// open, instead of leaving the PWA entirely — this app has no router-based
// history for its internal stage/overlay state (see App.tsx's routing
// comment), so by default a back gesture just navigates the browser away
// from the page.
//
// Pass the back-handler for whatever is *currently* topmost, or null if
// nothing dismissible is open. Critically, this takes ONE combined value
// for an entire group of mutually-exclusive screens (e.g. RootApp's
// otp/pin/deviceAuth/etc. stages) rather than one call per screen — an
// earlier per-screen version pushed a fresh history entry for every screen
// and popped it in cleanup whenever that screen's own `isOpen` went false,
// which also fired for a normal *forward* transition into the next tracked
// screen (e.g. PIN succeeding into Device Verification): that cleanup's
// own `history.back()` call fires a real popstate event, which the very
// next screen's brand-new listener immediately caught and treated as "go
// back," bouncing straight back to the previous screen. Keying everything
// on a single combined "is anything open" boolean instead means a forward
// hop between two tracked screens never touches history at all — only the
// true open/closed edges (nothing open -> something open, or back to
// nothing open) push or pop the one sentinel entry; popstate always calls
// whichever handler is current via a ref, so mid-flight handler changes
// need no extra bookkeeping.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from "react";

export function useBackNavigation(activeHandler: (() => void) | null) {
  const handlerRef = useRef(activeHandler);
  handlerRef.current = activeHandler;
  const isOpen = activeHandler !== null;

  useEffect(() => {
    if (!isOpen) return undefined;

    window.history.pushState({ gloobalBackNav: true }, "");
    let closedViaPopState = false;

    function handlePopState() {
      closedViaPopState = true;
      handlerRef.current?.();
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      // Closed via an in-app action (not the phone's back gesture) — undo
      // the entry pushed above so it doesn't linger as a dead "ghost" step
      // that the next real back-press would silently swallow instead of
      // actually leaving the app's tracked-screen stack entirely.
      if (!closedViaPopState) {
        window.history.back();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
}
