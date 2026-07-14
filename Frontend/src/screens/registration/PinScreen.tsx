import React from "react";
import { SubmitButton } from "../../components/common/FormPrimitives";
import { RegistrationScreenHeader } from "../../components/common/RegistrationScreenHeader";
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
  /** Optional soft, non-error status shown while `submitting` has been true
   * for a while — e.g. a note that a cold Render backend can take up to
   * 30s to wake up on its first request in a while. */
  hint?: string | null;
  /** "register" (default): setting a brand-new PIN after Referral.
   * "login": entering an existing PIN to sign in with an already-created
   * Secure ID. Same dial pad and submit logic either way — this only
   * changes the copy, which previously said "Confirm PIN" / "Creating
   * your Global ID…" even on the login path and read as if it were about
   * to create a second account. */
  mode?: "register" | "login";
}

// The dedicated, full-screen PIN step: shown after the Referral step
// (register mode) or after picking a Secure ID to sign in with (login
// mode), overlaying the whole stage the same way the country picker does.
// Gives the person a dial pad to type their PIN rather than a keyboard.
export function PinScreen({ value, length, onChange, onSubmit, onBack, submitting = false, error = null, hint = null, mode = "register" }: PinScreenProps) {
  const complete = value.length === length;
  const isLogin = mode === "login";
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
      <RegistrationScreenHeader onBack={onBack} title={isLogin ? "Enter your PIN" : "Set your PIN"} />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 26,
          padding: "28px 24px 40px",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 84,
            height: 84,
            borderRadius: "50%",
            background: T.gradPrimary,
            boxShadow: T.shadowRaised,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#fff" strokeWidth="2">
            <rect x="4" y="10" width="16" height="10" rx="2" />
            <path d="M8 10V7a4 4 0 118 0v3" strokeLinecap="round" />
          </svg>
        </div>

        <div>
          <h2 style={{ margin: 0, color: T.ink, fontSize: 24, lineHeight: 1.18, fontWeight: 900, fontFamily: T.fontDisplay }}>
            {isLogin ? "Enter your PIN" : "Choose your PIN"}
          </h2>
          <p style={{ margin: "12px auto 0", maxWidth: 290, color: T.inkSoft, fontSize: 14, lineHeight: 1.5, fontWeight: 600 }}>
            {isLogin
              ? "Enter the PIN for this Secure ID to log in."
              : `A ${length}-digit PIN protects your Global ID every time you log in.`}
          </p>
        </div>

        <PinDialPad value={value} onChange={onChange} length={length} />
        {submitting && hint && !error && (
          <p style={{ fontSize: 11.5, color: T.inkFaint, textAlign: "center", maxWidth: 240, margin: 0 }}>{hint}</p>
        )}
        {error && (
          <p style={{ fontSize: 12, fontWeight: 600, color: "#EF4444", textAlign: "center", margin: 0 }}>{error}</p>
        )}
        <SubmitButton
          onClick={onSubmit}
          disabled={!complete || submitting}
          label={
            isLogin
              ? submitting ? "Logging in…" : "Log In"
              : submitting ? "Creating your Global ID…" : "Confirm PIN"
          }
        />
      </div>
    </div>
  );
}
