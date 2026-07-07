import React from "react";
import { FlagEmoji } from "../../components/icons/MiscIcons";
import { T } from "../../styles/theme";
import { Phone } from "lucide-react";
import type { Country } from "../../types";

interface PhoneConnectorProps {
  country: Country;
  phoneNumber: string;
  onChangePhone: (next: string) => void;
  onOpenPicker: () => void;
  onActivate: () => void;
  verifying: boolean;
}

// The flag + chevron + line + phone-circle control, styled after the
// reference "Global ID" mock. Tapping the flag chip opens the country picker.
export function PhoneConnector({ country, phoneNumber, onChangePhone, onOpenPicker, onActivate, verifying }: PhoneConnectorProps) {
  const digits = phoneNumber.replace(/\D/g, "");
  const canActivate = digits.length >= 6 && !verifying;

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

      {/* Actual phone-number entry — the dial code is fixed to the chosen
          country and shown as a prefix; only the national number is typed. */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: T.surfaceAlt,
          borderRadius: T.radiusMd,
          padding: "11px 13px",
          border: `1px solid ${T.line}`,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 700, color: T.inkSoft, flexShrink: 0 }}>
          {country.dialCode}
        </span>
        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          value={phoneNumber}
          onChange={(e) => onChangePhone(e.target.value.replace(/[^\d\s-]/g, ""))}
          placeholder="Phone number"
          disabled={verifying}
          aria-label="Phone number"
          style={{
            flex: 1,
            minWidth: 0,
            border: "none",
            outline: "none",
            background: "none",
            fontSize: 14,
            fontWeight: 600,
            color: T.ink,
          }}
        />
      </div>

      <button
        onClick={onActivate}
        disabled={!canActivate}
        aria-label={verifying ? "Verifying your number" : canActivate ? "Verify my number" : "Enter your phone number to continue"}
        style={{
          width: 50,
          height: 50,
          borderRadius: "50%",
          border: "none",
          background: canActivate || verifying ? T.gradButton : T.gradButtonDisabled,
          boxShadow: canActivate || verifying ? "0 8px 18px rgba(124,58,237,0.32)" : "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: canActivate ? "pointer" : "not-allowed",
          opacity: canActivate || verifying ? 1 : 0.6,
          transition: "opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease",
          flexShrink: 0,
        }}
      >
        {verifying ? (
          <span
            style={{
              width: 16,
              height: 16,
              border: "2px solid rgba(255,255,255,0.35)",
              borderTopColor: "#fff",
              borderRadius: "50%",
              display: "inline-block",
              animation: "spin 0.7s linear infinite",
            }}
          />
        ) : (
          <svg viewBox="0 0 24 24" width="19" height="19" fill="#fff">
            <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.4 0 .8-.2 1l-2.3 2.2z" />
          </svg>
        )}
      </button>
    </div>
  );
}
