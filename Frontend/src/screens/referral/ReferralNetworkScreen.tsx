import React from "react";
import { T } from "../../styles/theme";
import { NetworkIcon } from "../../components/icons/MiscIcons";

interface ReferralNetworkScreenProps {
  referralCode: string;
  onClose: () => void;
}

interface PlaceholderReferral {
  label: string;
}

// UI-only placeholder network (no backend endpoint exists yet for this —
// see CLAUDE.md's endpoint table). Shows the shape the real tree will take
// once referral relationships are exposed by the API: the person at the
// root, their direct referrals branching below. Swap PLACEHOLDER_REFERRALS
// for a real fetched list the day that endpoint exists; nothing else here
// should need to change.
const PLACEHOLDER_REFERRALS: PlaceholderReferral[] = [
  { label: "User A" },
  { label: "User B" },
  { label: "User C" },
];

// Full-screen overlay, same header pattern as CountryPickerScreen/PinScreen.
// Renders a simple root -> children tree: "You" at the top, connected by
// plain CSS lines to each referred person below.
export function ReferralNetworkScreen({ referralCode, onClose }: ReferralNetworkScreenProps) {
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
          onClick={onClose}
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
        <span style={{ fontSize: 15, fontWeight: 800, color: T.ink, fontFamily: T.fontDisplay }}>Referral Network</span>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          WebkitOverflowScrolling: "touch",
          padding: "32px 24px 40px",
        }}
      >
        <p style={{ margin: "0 0 28px", fontSize: 13, color: T.inkSoft, textAlign: "center" }}>
          Everyone you've brought onto Global ID, at a glance.
        </p>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          {/* Root: You */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 20px",
              borderRadius: T.radiusLg,
              background: T.gradButton,
              boxShadow: "0 10px 24px rgba(124,58,237,0.3)",
            }}
          >
            <NetworkIcon color="#fff" />
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: "#fff" }}>You</div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.75)" }}>{referralCode}</div>
            </div>
          </div>

          {/* Connector stem from root down to the branch row */}
          <div style={{ width: 1.5, height: 22, background: T.line }} />

          {/* Branch row: each referred person hangs off a shared horizontal
              rail, mirroring the "You / |- A / |- B / `- C" text layout the
              founder sketched, rendered with real lines instead of ASCII. */}
          <div style={{ position: "relative", display: "flex", justifyContent: "center", width: "100%" }}>
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 0,
                left: "50%",
                transform: "translateX(-50%)",
                width: `calc(100% - ${100 / PLACEHOLDER_REFERRALS.length}%)`,
                maxWidth: 260,
                height: 1.5,
                background: T.line,
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", gap: 18, width: "100%", maxWidth: 320 }}>
              {PLACEHOLDER_REFERRALS.map((ref) => (
                <div key={ref.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                  <div style={{ width: 1.5, height: 16, background: T.line }} />
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 6,
                      padding: "12px 10px",
                      width: "100%",
                      borderRadius: T.radiusMd,
                      background: T.surface,
                      border: `1px solid ${T.line}`,
                      boxShadow: T.shadowCard,
                    }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        background: T.accentSoft,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 800,
                        color: T.accent,
                      }}
                    >
                      {ref.label.slice(-1)}
                    </div>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: T.ink, textAlign: "center" }}>{ref.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p style={{ margin: "32px 0 0", fontSize: 11.5, color: T.inkFaint, textAlign: "center" }}>
          Real referral names and counts will appear here once the network endpoint is live.
        </p>
      </div>
    </div>
  );
}
