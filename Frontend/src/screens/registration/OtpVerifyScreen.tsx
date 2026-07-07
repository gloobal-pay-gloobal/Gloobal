import React from "react";
import { CodeBoxes, SubmitButton } from "../../components/common/FormPrimitives";
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
}

// Prototype registration OTP screen — same full-screen layout family as
// PinScreen / DeviceVerificationScreen. Reuses the generic CodeBoxes
// component (the same one behind Secure ID / Referral entry) sized up for
// a 4-digit prototype code. Real backend calls (POST /api/otp/send,
// POST /api/otp/verify) live in RootApp / services/api/authApi.ts.
export function OtpVerifyScreen({ mobile, otp, onChangeOtp, onVerify, onBack, verifying, error, length }: OtpVerifyScreenProps) {
  const complete = otp.length === length;
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
        <span style={{ fontSize: 15, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>Verify Mobile</span>
      </div>

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

        {error && (
          <p style={{ margin: 0, color: "#dc2626", fontSize: 13, fontWeight: 700 }}>{error}</p>
        )}

        <SubmitButton onClick={onVerify} disabled={!complete || verifying} label={verifying ? "Verifying…" : "Verify OTP"} />
      </div>
    </div>
  );
}
