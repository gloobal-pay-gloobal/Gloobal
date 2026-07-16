import React from "react";
import { T } from "../../styles/theme";
import globalIdLogo from "../../assets/globalid-logo.png";

interface RegistrationScreenHeaderProps {
  onBack: () => void;
  backLabel?: string;
  title?: string;
  children?: React.ReactNode;
}

// Shared header bar for every full-screen registration-flow step (Country
// Picker, OTP, PIN, Device Verification) — same back button, same small
// Gloobal logo badge, same padding/border everywhere. Founder feedback was
// that the logo's size/placement drifted across these screens; routing
// them all through one component makes "identical" the only option
// instead of something four separate copies have to be kept in sync by
// hand. Pass `title` for a plain text header (OTP/PIN/Device Verification)
// or `children` for a custom header body (Country Picker's search field).
export function RegistrationScreenHeader({ onBack, backLabel = "Back", title, children }: RegistrationScreenHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "calc(18px + env(safe-area-inset-top, 0px)) 16px 12px",
        background: T.surface,
        borderBottom: `1px solid ${T.line}`,
      }}
    >
      <img
        src={globalIdLogo}
        alt="Gloobal ID"
        style={{ display: "block", width: 28, height: 28, objectFit: "contain", flexShrink: 0 }}
      />
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
        aria-label={backLabel}
      >
        ‹
      </button>
      {title ? (
        <span style={{ fontSize: 15, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>{title}</span>
      ) : (
        children
      )}
    </div>
  );
}
