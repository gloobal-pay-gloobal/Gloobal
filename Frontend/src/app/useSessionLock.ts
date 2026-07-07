// ---------------------------------------------------------------------------
// App lock: if the PWA is backgrounded (tab hidden, app switched away from,
// phone locked) for longer than LOCK_AFTER_MS, coming back shows a lock
// screen requiring the PIN again — the same pattern every banking app uses.
// Uses the Page Visibility API (document.visibilitychange), which fires
// reliably both for "switched tabs" and "backgrounded the PWA on a phone."
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";

const LOCK_AFTER_MS = 30_000; // 30s backgrounded triggers a lock — tune per real UX research
const HIDDEN_AT_KEY = "gloobal:hiddenAt";

interface UseSessionLockOptions {
  /** Lock is only meaningful once someone is actually past authentication —
   * pass false while still on the login/registration screens. */
  enabled: boolean;
}

export function useSessionLock({ enabled }: UseSessionLockOptions) {
  const [locked, setLocked] = useState(false);
  const hiddenAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return undefined;

    // Covers the case where the tab was hidden, then the whole page was
    // reloaded/relaunched while hidden — sessionStorage survives that,
    // a plain in-memory ref wouldn't.
    const storedHiddenAt = sessionStorage.getItem(HIDDEN_AT_KEY);
    if (storedHiddenAt) {
      const elapsed = Date.now() - Number(storedHiddenAt);
      if (elapsed > LOCK_AFTER_MS) setLocked(true);
      sessionStorage.removeItem(HIDDEN_AT_KEY);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = Date.now();
        sessionStorage.setItem(HIDDEN_AT_KEY, String(hiddenAtRef.current));
      } else if (document.visibilityState === "visible") {
        sessionStorage.removeItem(HIDDEN_AT_KEY);
        if (hiddenAtRef.current !== null) {
          const elapsed = Date.now() - hiddenAtRef.current;
          if (elapsed > LOCK_AFTER_MS) setLocked(true);
          hiddenAtRef.current = null;
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [enabled]);

  const unlock = () => setLocked(false);

  return { locked, unlock };
}
