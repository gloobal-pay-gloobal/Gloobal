import React from "react";
import {
  Fingerprint,
  ScanFace,
} from "lucide-react";
import { PhoneDialPad } from "../common/DialPads";
import { T } from "../../styles/theme";
import { PinScreenHeader, PinChipCard } from "./PinScreenShell";

// Shown right after a successful Secure ID or mobile-number login, before
// the dashboard — the same full-screen overlay treatment as PinScreen, but
// with Face / Fingerprint offered as a one-tap alternative to typing the
// PIN. Either path lands on the dashboard.
export function LoginAuthScreen({ value, length, onChange, onSubmit, onBack, revealed, onToggleReveal, onBiometric, scanning }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: T.bg,
        display: "flex",
        flexDirection: "column",
        fontFamily: T.fontBody,
      }}
    >
      <PinScreenHeader onBack={onBack} title="Verify it's you" />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 24,
          padding: "40px 24px 40px",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <PinChipCard length={length} value={value} revealed={revealed} onToggleReveal={onToggleReveal} />

        <PhoneDialPad value={value} onChange={onChange} minLength={length} maxLength={length} onSubmit={onSubmit} />

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", maxWidth: 260 }}>
          <span style={{ flex: 1, height: 1, background: T.line }} />
          <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, color: T.inkFaint, textTransform: "uppercase" }}>or</span>
          <span style={{ flex: 1, height: 1, background: T.line }} />
        </div>

        {/* Face / Fingerprint — either one is a one-tap shortcut past the
            PIN, landing on the dashboard the same way a completed PIN
            does. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 28 }}>
          <button
            onClick={() => onBiometric("face")}
            disabled={scanning}
            aria-label="Verify with Face ID"
            className="v2-tap"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              border: "none",
              background: "none",
              cursor: scanning ? "default" : "pointer",
            }}
          >
            <span
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                border: `1.5px solid ${T.line}`,
                background: T.surface,
                boxShadow: T.shadowCard,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: T.accent,
                animation: scanning ? "iconAttention 0.7s ease-in-out infinite" : "none",
              }}
            >
              <ScanFace size={26} />
            </span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: T.inkFaint }}>Face ID</span>
          </button>

          <button
            onClick={() => onBiometric("fingerprint")}
            disabled={scanning}
            aria-label="Verify with fingerprint"
            className="v2-tap"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              border: "none",
              background: "none",
              cursor: scanning ? "default" : "pointer",
            }}
          >
            <span
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                border: `1.5px solid ${T.line}`,
                background: T.surface,
                boxShadow: T.shadowCard,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: T.accent,
                animation: scanning ? "iconAttention 0.7s ease-in-out infinite" : "none",
              }}
            >
              <Fingerprint size={26} />
            </span>
            <span style={{ fontSize: 10.5, fontWeight: 700, color: T.inkFaint }}>Fingerprint</span>
          </button>
        </div>
      </div>
    </div>
  );
}
