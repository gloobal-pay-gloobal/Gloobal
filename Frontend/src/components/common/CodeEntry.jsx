import React, { useEffect, useRef, useState } from "react";
import { T } from "../../styles/theme";

// A single-row of single-character boxes for entering a fixed-length code
// (used for both the Secure ID and the referral code). Always stays on one
// line, auto-advances focus forward on type and backward on
// backspace-into-empty, and reports back the assembled string on every change.
export function CodeBoxes({ length, value, onChange, boxSize = 19, autoFocusFirst, justify = "center" }) {
  const refs = useRef([]);
  const chars = value.split("");

  const setChar = (i, c) => {
    const next = value.split("");
    while (next.length < length) next.push("");
    next[i] = c;
    onChange(next.join("").slice(0, length).replace(/\s+$/, (m) => m));
  };

  const handleChange = (i, raw) => {
    const c = raw.slice(-1);
    setChar(i, c);
    if (c && i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === "Backspace" && !chars[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  };

  return (
    <div style={{ display: "flex", flexWrap: "nowrap", gap: 3, justifyContent: justify, overflowX: "auto" }}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          autoFocus={autoFocusFirst && i === 0}
          value={chars[i] || ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          maxLength={1}
          inputMode="text"
          aria-label={`Character ${i + 1} of ${length}`}
          style={{
            width: boxSize,
            height: boxSize * 1.2,
            flexShrink: 0,
            textAlign: "center",
            fontSize: 14,
            fontWeight: 700,
            color: T.ink,
            background: T.surfaceAlt,
            border: "1.5px solid " + (chars[i] ? T.accent : T.line),
            borderRadius: 9,
            outline: "none",
            transition: "border-color 0.15s ease, background 0.15s ease",
          }}
        />
      ))}
    </div>
  );
}
// A code-entry row with its label sitting to the left of the boxes, outside
// them, instead of floating above as a badge. Used for the Secure ID and
// Referral ID steps.
export function LabeledCodeRow({ label, length, value, onChange, autoFocusFirst }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
      <span
        style={{
          flexShrink: 0,
          width: 60,
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: 0.3,
          textTransform: "uppercase",
          color: T.accent,
          lineHeight: 1.25,
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <CodeBoxes
          length={length}
          value={value}
          onChange={onChange}
          autoFocusFirst={autoFocusFirst}
          boxSize={16}
          justify="flex-start"
        />
      </div>
    </div>
  );
}
// The pill-style "Submit" / "Continue" button shared by the Secure ID,
// Referral, and PIN steps. Disabled (greyed, non-interactive) until the
// field it belongs to is fully filled in.
function SubmitButtonBase({ onClick, disabled, label = "Submit" }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="v2-tap"
      style={{
        marginTop: 16,
        border: "none",
        borderRadius: T.radiusMd,
        padding: "11px 30px",
        fontSize: 13,
        fontWeight: 800,
        letterSpacing: 0.2,
        color: "#fff",
        cursor: disabled ? "default" : "pointer",
        background: disabled ? T.gradButtonDisabled : T.gradButton,
        boxShadow: disabled ? "none" : "0 8px 20px rgba(124,58,237,0.32)",
        transition: "box-shadow 0.15s ease, background 0.15s ease, transform 0.1s ease",
      }}
    >
      {label}
    </button>
  );
}
export const SubmitButton = React.memo(SubmitButtonBase);

// Each entered slot gets its own color by position (not by which symbol
// was typed) — so a run of the same symbol, like "++++++++++++", reads as
// twelve distinct colors in sequence rather than one flat color. Cycles
// if a field is ever longer than the palette.
export const POSITION_COLORS = [
  "#7C3AED", // violet (app accent)
  "#EC4899", // pink
  "#3B82F6", // blue
  "#10B981", // green
  "#F59E0B", // amber
  "#EF4444", // red
  "#06B6D4", // cyan
  "#F97316", // orange
  "#8B5CF6", // purple
  "#14B8A6", // teal
  "#D946EF", // fuchsia
  "#84CC16", // lime
];
// A read-only display of the symbols entered so far for Secure ID /
// Referral ID — chips instead of a live text input, since neither field
// should ever bring up the system keyboard. The dial that fills these in
// is always visible below the card now, so this is just a display. When
// `masked` is true, filled slots show a dot instead of the real symbol —
// paired with the eye button next to it. No inline label here — that
// lives on the card's boundary (the "Secure ID" / "Referral ID" corner
// badge) instead, so the full row width goes to chips + the eye button.
function SymbolChipRowBase({ length, value, masked, boxSize = 21, justify = "flex-start" }) {
  const chars = value.split("");
  return (
    <div
      aria-label={`${chars.length} of ${length} entered`}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexWrap: "nowrap", justifyContent: justify, gap: boxSize > 21 ? 8 : 3, overflowX: "auto" }}>
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            style={{
              width: boxSize,
              height: boxSize * 1.2,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: boxSize > 21 ? 18 : 13,
              fontWeight: 800,
              color: chars[i] && !masked ? POSITION_COLORS[i % POSITION_COLORS.length] : T.ink,
              background: chars[i] ? T.accentSoft : T.surfaceAlt,
              border: "1.5px solid " + (chars[i] ? T.accent : T.line),
              borderRadius: 9,
              transition: "border-color 0.15s ease, background 0.15s ease",
            }}
          >
            {chars[i] ? (masked ? "•" : chars[i]) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
export const SymbolChipRow = React.memo(SymbolChipRowBase);

// Small show/hide toggle icon, used next to the Secure ID / Referral ID
// chip rows to reveal or mask the entered symbols.
function MaskEyeIconBase({ open, color }) {
  return open ? (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke={color} strokeWidth="2.2">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke={color} strokeWidth="2.2">
      <path
        d="M3 3l18 18M10.6 10.6a3 3 0 004.24 4.24M9.9 5.1A10.6 10.6 0 0112 5c6.5 0 10 7 10 7a13.2 13.2 0 01-3.1 3.9M6.2 6.9C3.6 8.6 2 12 2 12a13.4 13.4 0 003.3 4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
export const MaskEyeIcon = React.memo(MaskEyeIconBase);

// A small badge label that cycles through a short list of words instead of
// sitting static — used for the Secure ID card's corner badge so it can
// say "Create", "Secure", "Gloobal", "Id" in turn rather than only one of
// them. Deliberately a simple opacity/translate pop rather than a 3D
// transform, so it renders reliably everywhere.
function CyclingBadgeBase({ words, intervalMs = 1400 }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % words.length), intervalMs);
    return () => clearInterval(id);
  }, [words, intervalMs]);
  return (
    <span key={index} style={{ display: "inline-block", animation: "badgePop 0.35s ease" }}>
      {words[index]}
    </span>
  );
}
export const CyclingBadge = React.memo(CyclingBadgeBase);

