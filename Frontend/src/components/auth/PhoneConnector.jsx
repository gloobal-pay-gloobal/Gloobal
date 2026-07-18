import React from "react";
import {
  Phone,
} from "lucide-react";
import { FlagEmoji } from "../common/FlagComponents";
import { mobileDigitRange } from "../../constants/countries";
import { T } from "../../styles/theme";

// The flag + chevron + line + phone-circle control, styled after the
// reference "Gloobal ID" mock. Tapping the flag chip opens the country picker.
export function PhoneConnector({ country, phoneNumber, onOpenPicker, onOpenDial, dialOpen, onActivate, verifying, showLogin, onLoginTap }) {
  const digits = phoneNumber.replace(/\D/g, "");
  const [minLen, maxLen] = mobileDigitRange(country.iso);
  const canActivate = digits.length >= minLen && digits.length <= maxLen && !verifying;

  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 10 }}>
      <button
        onClick={onOpenPicker}
        aria-label={`Country: ${country.name}, ${country.dialCode}. Tap to change`}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: 0,
          border: "none",
          background: "none",
          cursor: "pointer",
          flexShrink: 0,
          transition: "transform 0.12s ease",
        }}
      >
        <FlagEmoji
          flag={country.flag}
          width={46}
          height={40}
          radius={13}
          dropShadow="drop-shadow(0 4px 10px rgba(76,29,149,0.22))"
        />
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke={T.accent} strokeWidth="3">
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Phone-number entry — the dial code is fixed to the chosen country
          (shown via the flag, not spelled out here); only the national
          number is typed. No native keyboard: tapping opens our own dial
          pad below, same as everywhere else in the app. The real digits
          are shown once, in the dial pad below; this field just mirrors
          progress with big dots so the number isn't shown twice. */}
      <button
        onClick={onOpenDial}
        disabled={verifying}
        aria-label={`Phone number, ${country.dialCode}. Tap to enter with dial pad`}
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: digits ? "center" : "flex-start",
          background: T.surfaceAlt,
          borderRadius: T.radiusMd,
          padding: "9px 13px",
          border: `1px solid ${dialOpen ? T.accent : T.line}`,
          cursor: verifying ? "default" : "pointer",
          textAlign: "left",
        }}
      >
        {digits ? (
          <span
            aria-label={`${digits.length} digits entered`}
            style={{
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: 6,
              color: T.accent,
              lineHeight: 1,
            }}
          >
            {"•".repeat(digits.length)}
          </span>
        ) : (
          <span style={{ fontSize: 14, fontWeight: 600, color: T.inkFaint }}>Phone number</span>
        )}
      </button>

      {/* The call icon that used to sit here (and call onActivate to jump
          straight to OTP) has been removed — the dial pad below already
          has its own IN key that does the exact same submit, so this was
          a duplicate control. The login flip button still lives in this
          same spot when showLogin is true. */}
      {showLogin && (
        <div style={{ position: "relative", width: 50, height: 50, flexShrink: 0 }}>
          <button
            onClick={onLoginTap}
            aria-label="Log in"
            className="phone-flip-btn"
            style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              border: `1.5px solid ${T.line}`,
              background: T.surface,
              color: T.accent,
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: 0.3,
              boxShadow: T.shadowCard,
            }}
          >
            IN
          </button>
        </div>
      )}
    </div>
  );
}
