import React from "react";
import { T } from "../../styles/theme";
import { X } from "lucide-react";

// Shared bottom-sheet shell for the two info-corner explanation overlays
// (Gloobal ID symbols, Referral benefits) — same shell used by Receive
// History and the other bottom sheets elsewhere in the app.
export function ExplainSheet({ title, onClose, children }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(15,12,35,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 430, maxHeight: "78vh", display: "flex", flexDirection: "column", background: T.surface, borderRadius: "26px 26px 0 0", padding: "26px 22px 34px", boxShadow: T.shadowFloat, overflowY: "auto", WebkitOverflowScrolling: "touch" }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexShrink: 0 }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>{title}</span>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: T.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
          >
            <X size={15} color={T.inkSoft} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
