import React from "react";

// Purely additive UI: invisible unless a background update is ready. Kept
// completely outside App.jsx so the existing screens/flow are untouched —
// this just floats above whatever is currently on screen, the same way
// Play Store apps show an "Update available" snackbar without disturbing
// what you were doing.
export function UpdateToast({ visible, onUpdate, onDismiss }) {
  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        left: "50%",
        bottom: "calc(18px + var(--safe-bottom, 0px))",
        transform: "translateX(-50%)",
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 10px 10px 16px",
        borderRadius: 999,
        background: "#14122B",
        color: "#fff",
        boxShadow: "0 12px 28px rgba(20,18,43,0.35)",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        fontSize: 13,
        fontWeight: 600,
        maxWidth: "calc(100vw - 32px)",
        animation: "update-toast-in 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <span>A new version is ready</span>
      <button
        onClick={onUpdate}
        style={{
          border: "none",
          borderRadius: 999,
          padding: "7px 14px",
          fontSize: 12.5,
          fontWeight: 800,
          letterSpacing: 0.2,
          color: "#14122B",
          background: "#fff",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        Restart
      </button>
      <button
        onClick={onDismiss}
        aria-label="Dismiss update notice"
        style={{
          border: "none",
          background: "none",
          color: "rgba(255,255,255,0.6)",
          fontSize: 16,
          lineHeight: 1,
          padding: "4px 2px",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        ×
      </button>
      <style>{`
        @keyframes update-toast-in {
          from { opacity: 0; transform: translate(-50%, 10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}
