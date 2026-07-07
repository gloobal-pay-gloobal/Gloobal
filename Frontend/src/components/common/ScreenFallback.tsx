import React from "react";
import { T } from "../../styles/theme";

// Shown by <Suspense> for the brief window between an activeScreen/stage
// change and its code-split chunk finishing its fetch — a skeleton rather
// than a bare spinner, per this app's "loading states should look like the
// thing that's loading, not a generic wait" standard. On a warm cache
// (chunk already fetched this session) this typically never paints at
// all; it exists for the first cold navigation to each screen and for
// slow/offline networks.
export function ScreenFallback() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 250,
        background: T.bg,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "calc(20px + env(safe-area-inset-top, 0px)) 20px 20px",
      }}
      role="status"
      aria-live="polite"
      aria-label="Loading screen"
    >
      <style>{`
        @keyframes screenFallbackPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        .sf-block { animation: screenFallbackPulse 1.3s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .sf-block { animation: none; opacity: 0.75; } }
      `}</style>
      <div className="sf-block" style={{ width: 34, height: 34, borderRadius: "50%", background: T.line }} />
      <div className="sf-block" style={{ width: "60%", height: 16, borderRadius: 8, background: T.line }} />
      <div className="sf-block" style={{ width: "100%", height: 90, borderRadius: T.radiusLg, background: T.line, marginTop: 8 }} />
      <div className="sf-block" style={{ width: "100%", height: 52, borderRadius: T.radiusMd, background: T.line }} />
      <div className="sf-block" style={{ width: "80%", height: 52, borderRadius: T.radiusMd, background: T.line }} />
    </div>
  );
}
