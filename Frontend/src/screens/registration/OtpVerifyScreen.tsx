import React, { useEffect, useState } from "react";
import { CodeBoxes, SubmitButton } from "../../components/common/FormPrimitives";
import { RegistrationScreenHeader } from "../../components/common/RegistrationScreenHeader";
import { T } from "../../styles/theme";
import { Phone } from "lucide-react";

interface OtpVerifyScreenProps {
  mobile: string;
  otp: string;
  onChangeOtp: (next: string) => void;
  onVerify: () => void;
  onBack: () => void;
  verifying: boolean;
  error?: string | null;
  length: number;
  /** Optional soft, non-error status shown while `verifying` has been true
   * for a while — mirrors PinScreen's `hint`: a note that a cold Render
   * backend can take up to 30s to wake up on its first request in a while. */
  hint?: string | null;
  /** Re-sends the OTP to the same mobile number (POST /api/otp/send again).
   * Optional so this stays a drop-in without it. */
  onResend?: () => void;
  /** True while a resend request is in flight — kept separate from
   * `verifying` so "Resend" and "Verify OTP" never fight over one loading
   * flag. */
  resending?: boolean;
  /** Epoch ms after which Resend becomes tappable again; before that the
   * button shows a countdown instead, so it's never a dead re-tap target
   * right after a send. */
  resendAvailableAt?: number | null;
}

// Prototype registration OTP screen — same full-screen layout family as
// PinScreen / DeviceVerificationScreen. Reuses the generic CodeBoxes
// component (the same one behind Secure ID / Referral entry) sized up for
// a 4-digit prototype code. Real backend calls (POST /api/otp/send,
// POST /api/otp/verify) live in RootApp / services/api/authApi.ts.
export function OtpVerifyScreen({
  mobile,
  otp,
  onChangeOtp,
  onVerify,
  onBack,
  verifying,
  error,
  length,
  hint,
  onResend,
  resending = false,
  resendAvailableAt = null,
}: OtpVerifyScreenProps) {
  const complete = otp.length === length;

  // Ticks a plain "Resend in Ns" countdown off resendAvailableAt — recomputed
  // once a second rather than scheduled precisely, since this is only ever
  // off by under a second and that's invisible at this granularity.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!resendAvailableAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [resendAvailableAt]);
  const secondsLeft = resendAvailableAt ? Math.max(0, Math.ceil((resendAvailableAt - now) / 1000)) : 0;
  const canResend = !!onResend && !resending && !verifying && secondsLeft === 0;

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
      <RegistrationScreenHeader onBack={onBack} title="Verify Mobile" />

      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 22,
          padding: "32px 24px 40px",
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 118,
            height: 118,
            borderRadius: "50%",
            background: T.gradPrimary,
            boxShadow: T.shadowRaised,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Phone size={38} color="#fff" strokeWidth={2.2} />
        </div>

        <div>
          <h2 style={{ margin: 0, color: T.ink, fontSize: 24, lineHeight: 1.18, fontWeight: 900, fontFamily: T.fontDisplay }}>
            Enter OTP sent to your mobile
          </h2>
          <p style={{ margin: "12px auto 0", maxWidth: 290, color: T.inkSoft, fontSize: 14, lineHeight: 1.5, fontWeight: 600 }}>
            {mobile ? `Sent to ${mobile}.` : "Sent to your mobile number."} Prototype OTP is 0000.
          </p>
        </div>

        <CodeBoxes length={length} value={otp} onChange={onChangeOtp} boxSize={44} autoFocusFirst />

        {verifying && hint && !error && (
          <p style={{ margin: 0, fontSize: 11.5, color: T.inkFaint, maxWidth: 240 }}>{hint}</p>
        )}

        {error && (
          <p style={{ margin: 0, color: "#dc2626", fontSize: 13, fontWeight: 700 }}>{error}</p>
        )}

        <SubmitButton onClick={onVerify} disabled={!complete || verifying} label={verifying ? "Verifying…" : "Verify OTP"} />

        {onResend && (
          <button
            type="button"
            onClick={onResend}
            disabled={!canResend}
            style={{
              border: "none",
              background: "none",
              fontSize: 12.5,
              fontWeight: 700,
              color: canResend ? T.accent2 : T.inkFaint,
              cursor: canResend ? "pointer" : "default",
              padding: "6px 8px",
            }}
          >
            {resending ? "Resending…" : secondsLeft > 0 ? `Resend OTP in ${secondsLeft}s` : "Resend OTP"}
          </button>
        )}
      </div>
    </div>
  );
}
