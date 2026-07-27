import React from "react";
import {
  Fingerprint,
  ScanFace,
} from "lucide-react";
import { PhoneDialPad } from "../common/DialPads";
import { T } from "../../styles/theme";
import { PinScreenHeader, PinChipCard } from "./PinScreenShell";

// Shown right after a successful Secure ID or mobile-number login, before
// the dashboard — the same full-screen overlay treatment as PinScreen.
//
// mode="login" (default): PIN entry only. Real POST /api/login fires on
// submit. Face ID / Fingerprint are deliberately NOT on this screen — no
// icons, no link. Two competing ways to authenticate on one page read as
// "which of these am I supposed to use?", so the biometric offer lives on
// its own screen shown *after* a correct PIN (mode="setup"), exactly the
// way registration does it.
// mode="biometric": nothing but the two full-size biometric buttons (real
// POST /api/passkey/auth/*) and a back button returning to the PIN screen,
// which keeps whatever was already typed.
// mode="setup": shown once, right after a PIN is accepted (registration, or
// a login where no passkey exists yet), so a real passkey can be registered
// for faster login next time. Same full-size buttons (real
// POST /api/passkey/register/*) plus a "Skip for now" link, since a passkey
// is a nice-to-have, not a requirement to reach the dashboard.
export function LoginAuthScreen({
  value,
  length,
  onChange,
  onSubmit,
  onBack,
  revealed,
  onToggleReveal,
  onBiometric,
  scanning,
  mode = "login",
  error,
  status,
  onSkip,
}) {
  // The two biometric-led screens (one-time setup, and the login-time
  // biometric screen reached from the PIN screen's link) lead with these
  // buttons — they are the whole screen, not an alternative to a dial pad —
  // so they get a noticeably larger target.
  const isSetup = mode === "setup";
  const isBiometric = mode === "biometric";
  const showsBiometricButtons = isSetup || isBiometric;
  const bioCircleSize = 88;
  const bioIconSize = 44;

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
      <PinScreenHeader onBack={onBack} title={isSetup ? "Set up device security" : "Verify it's you"} />

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
        {isSetup && (
          <p style={{ margin: 0, textAlign: "center", color: T.inkSoft, fontSize: 13, fontWeight: 600, maxWidth: 280 }}>
            Add Face ID or a fingerprint so you can skip typing your PIN next time you log in.
          </p>
        )}

        {isBiometric && (
          <p style={{ margin: 0, textAlign: "center", color: T.inkSoft, fontSize: 13, fontWeight: 600, maxWidth: 280 }}>
            Use the Face ID or fingerprint already saved on this device instead of typing your PIN.
          </p>
        )}

        {!showsBiometricButtons && (
          <>
            {/* Same "Gloobal ID" heading the landing, Secure ID, and
                Referral steps carry, so this screen is recognisably part
                of the same flow rather than an unlabelled PIN prompt. */}
            <span
              style={{
                fontSize: "clamp(22px, 7vw, 28px)",
                fontWeight: 800,
                letterSpacing: 0.5,
                lineHeight: 1.1,
                whiteSpace: "nowrap",
                color: T.ink,
                fontFamily: T.fontDisplay,
              }}
            >
              Gl<span style={{ color: T.accent2 }}>o</span>
              <span style={{ color: "#C026D3" }}>o</span>bal ID
            </span>
            <PinChipCard length={length} value={value} revealed={revealed} onToggleReveal={onToggleReveal} />
            <PhoneDialPad value={value} onChange={onChange} minLength={length} maxLength={length} onSubmit={onSubmit} />

            {/* No Face ID / Fingerprint link here on purpose. The PIN screen
                asks for a PIN and nothing else; the biometric offer is a
                separate screen shown *after* a correct PIN, the same way
                registration does it, so the two never compete on one page. */}
          </>
        )}

        {/* Face / Fingerprint — either one is a one-tap shortcut past the
            PIN, landing on the dashboard the same way a completed PIN
            does. */}
        {showsBiometricButtons && (
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
                width: bioCircleSize,
                height: bioCircleSize,
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
              <ScanFace size={bioIconSize} />
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: T.inkFaint }}>Face ID</span>
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
                width: bioCircleSize,
                height: bioCircleSize,
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
              <Fingerprint size={bioIconSize} />
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: T.inkFaint }}>Fingerprint</span>
          </button>
        </div>
        )}

        {status && !error && (
          <p style={{ margin: 0, textAlign: "center", color: T.inkFaint, fontSize: 12, fontWeight: 600 }}>{status}</p>
        )}
        {error && (
          <p style={{ margin: 0, textAlign: "center", color: "#dc2626", fontSize: 12, fontWeight: 700 }}>{error}</p>
        )}

        {mode === "setup" && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            disabled={scanning}
            className="v2-tap"
            style={{
              border: "none",
              background: "none",
              color: T.inkFaint,
              fontSize: 12,
              fontWeight: 700,
              cursor: scanning ? "default" : "pointer",
              padding: "6px 8px",
              textDecoration: "underline",
            }}
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
