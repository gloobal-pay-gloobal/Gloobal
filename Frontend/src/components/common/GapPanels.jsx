import React from "react";
import { T } from "../../styles/theme";

// The two small panels that live in the gap between the entry card and the
// dial pad — previously dead space on both the ID-creation and the login
// screen. They're separate components (not one panel with a mode flag)
// because they carry unrelated information and never appear together:
// suggestions belong to registration, the last-login bar to login.
//
// Both fade in with the same opacity + translateY motion so the gap
// behaves consistently whichever screen you're on.

const FADE_IN_KEYFRAMES = `
  @keyframes gapPanelIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @media (prefers-reduced-motion: reduce) { .gap-panel-in { animation: none !important; } }
`;

/**
 * "Suggested IDs" — two tappable near-misses of the ID the person just
 * tried, shown only while that ID is known to be taken. Tapping a pill
 * adopts it, which re-runs the same availability check.
 */
export function IdSuggestionsPanel({ suggestions, onPick }) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div
      className="gap-panel-in"
      data-testid="id-suggestions"
      style={{
        width: "100%",
        marginTop: 12,
        padding: 10,
        boxSizing: "border-box",
        borderRadius: T.radiusMd,
        background: "rgba(243,241,250,0.9)",
        border: `1px solid ${T.line}`,
        animation: "gapPanelIn 200ms ease-out",
      }}
    >
      <style>{FADE_IN_KEYFRAMES}</style>
      <div style={{ fontSize: 12, fontWeight: 600, color: T.inkFaint, marginBottom: 8 }}>Suggested IDs</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            aria-label={`Use suggested Gloobal ID ${s}`}
            className="v2-tap"
            style={{
              border: `1px solid ${T.accent}`,
              borderRadius: 999,
              background: T.surface,
              color: T.accent,
              fontSize: 13,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              letterSpacing: 1,
              padding: "6px 14px",
              cursor: "pointer",
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * "Last login: 22 Jul 2026, 1:19 PM" — shown once the typed Gloobal ID has
 * been recognized. `formatted` being null means the ID is known but has no
 * recorded sign-in yet, which reads as "First time logging in" rather than
 * hiding the bar.
 */
export function LastLoginBar({ formatted, detail }) {
  const text = formatted
    ? `Last login: ${formatted}${detail ? ` · ${detail}` : ""}`
    : "First time logging in";

  return (
    <div
      className="gap-panel-in"
      data-testid="last-login-bar"
      style={{
        marginTop: 12,
        display: "flex",
        justifyContent: "center",
        width: "100%",
        animation: "gapPanelIn 200ms ease-out",
      }}
    >
      <style>{FADE_IN_KEYFRAMES}</style>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          maxWidth: "100%",
          background: "rgba(124,58,237,0.07)",
          border: "1px solid rgba(124,58,237,0.2)",
          borderRadius: 20,
          padding: "6px 16px",
          fontSize: 12,
          color: T.inkSoft,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        <span aria-hidden="true">🕐</span>
        {text}
      </span>
    </div>
  );
}
