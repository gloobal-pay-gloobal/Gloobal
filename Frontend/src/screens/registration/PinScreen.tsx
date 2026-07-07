import React from "react";
import { SubmitButton } from "../../components/common/FormPrimitives";
import { PinDialPad } from "../../components/dial/SymbolDial";
import { T } from "../../styles/theme";

interface PinScreenProps {
  value: string;
  length: number;
  onChange: (next: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  /** True while the real POST /auth/register call (RootApp) is in
   * flight. Optional/defaulted so this stays a drop-in for any other
   * caller that doesn't need it. */
  submitting?: boolean;
  /** Set when that call fails — a real backend can genuinely reject
   * registration (duplicate account, validation, network), unlike the
   * old local-state-only version of this stage which could not fail. */
  error?: string | null;
}

// The dedicated, full-screen PIN step: shown after the Referral step,
// overlaying the whole stage the same way the country picker does. Gives
// the person a dial pad to type their PIN rather than a keyboard.
export function PinScreen({ value, length, onChange, onSubmit, onBack, submitting = false, error = null }: PinScreenProps) {
  const complete = value.length === length;
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
        <span style={{ fontSize: 15, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>Set your PIN</span>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 24,
          padding: "32px 24px 40px",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: T.gradPrimary,
            boxShadow: T.shadowRaised,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#fff" strokeWidth="2">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 118 0v3" strokeLinecap="round" />
          </svg>
        </div>
        <p style={{ fontSize: 13, color: T.inkSoft, textAlign: "center", maxWidth: 260, margin: 0 }}>
          Choose a {length}-digit PIN to protect your Global ID
        </p>
        <PinDialPad value={value} onChange={onChange} length={length} />
        {error && (
          <p style={{ fontSize: 12, fontWeight: 600, color: "#EF4444", textAlign: "center", margin: 0 }}>{error}</p>
        )}
        <SubmitButton
          onClick={onSubmit}
          disabled={!complete || submitting}
          label={submitting ? "Creating your Global ID…" : "Confirm PIN"}
        />
      </div>
    </div>
  );
}
