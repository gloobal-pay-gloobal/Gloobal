import React from "react";
import { PhoneConnector } from "./PhoneConnector";
import { T } from "../../styles/theme";

// The same circular "IN" button PhoneConnector uses on the registration
// phone screen, extracted so login's Secure ID and mobile modes can use
// the identical tap target instead of a separate wide pill button below.
export function CircularInButton({ onClick, disabled, size = 40 }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label="Log in"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: "none",
        background: disabled ? T.gradButtonDisabled : T.gradButton,
        boxShadow: disabled ? "none" : "0 8px 18px rgba(124,58,237,0.32)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        color: "#fff",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: 0.3,
        flexShrink: 0,
        transition: "opacity 0.15s ease, box-shadow 0.15s ease",
      }}
    >
      IN
    </button>
  );
}
