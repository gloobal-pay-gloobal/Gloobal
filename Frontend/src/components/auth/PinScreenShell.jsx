import React from "react";
import { MaskEyeIcon, SymbolChipRow } from "../common/CodeEntry";
import { T } from "../../styles/theme";

// The back button + title bar shared by PinScreen and LoginAuthScreen —
// identical markup in both, just a different title string.
export function PinScreenHeader({ onBack, title }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "18px 16px 12px",
        background: T.surface,
        borderBottom: `1px solid ${T.line}`,
      }}
    >
      <button
        onClick={onBack}
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          border: "none",
          background: T.surfaceAlt,
          fontSize: 18,
          color: T.ink,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
        aria-label="Back"
      >
        ‹
      </button>
      <span style={{ fontSize: 15, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>{title}</span>
    </div>
  );
}

// The PIN card — corner badge, eye toggle, and chip row — shared by
// PinScreen and LoginAuthScreen. Same treatment as the Secure ID /
// Referral ID / OTP cards, so every code-entry screen in the app reads as
// part of the same family.
export function PinChipCard({ length, value, revealed, onToggleReveal }) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "22px 14px",
        borderRadius: T.radiusLg,
        boxShadow: T.shadowFloat,
        border: `1px solid ${T.line}`,
        background: T.surface,
        boxSizing: "border-box",
        overflow: "visible",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: -11,
          left: 16,
          background: T.surface,
          border: `1px solid ${T.line}`,
          borderRadius: 7,
          padding: "3px 9px",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          color: T.accent,
          boxShadow: T.shadowCard,
        }}
      >
        PIN
      </span>

      <button
        onClick={onToggleReveal}
        aria-label={revealed ? "Hide PIN" : "Show PIN"}
        className="v2-tap"
        style={{
          position: "absolute",
          top: -11,
          right: 16,
          width: 24,
          height: 24,
          borderRadius: "50%",
          border: `1px solid ${T.line}`,
          background: T.surface,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: T.shadowCard,
        }}
      >
        <MaskEyeIcon open={revealed} color={T.inkSoft} />
      </button>

      <SymbolChipRow length={length} value={value} masked={!revealed} boxSize={34} justify="center" />
    </div>
  );
}
