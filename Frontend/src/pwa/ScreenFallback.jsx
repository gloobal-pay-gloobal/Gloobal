import React from "react";
import { T } from "../styles/theme";

// Screens are almost always served from the service worker's cache after
// the first visit, so this is rarely seen in practice — it exists purely
// so a slow/first-ever chunk load never shows blank white instead of the
// app's own background.
export function ScreenFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 190,
        background: T.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 30,
          height: 30,
          border: `3px solid ${T.line}`,
          borderTopColor: T.accent,
          borderRadius: "50%",
          display: "inline-block",
          animation: "spin 0.7s linear infinite",
        }}
      />
    </div>
  );
}
