import React, { useRef } from "react";
import { SYMBOL_COLORS } from "../../lib/symbolColors";
import { T } from "../../styles/theme";
import type { DialSymbol } from "../../types";

interface CodeBoxesProps {
  length: number;
  value: string;
  onChange: (next: string) => void;
  boxSize?: number;
  autoFocusFirst?: boolean;
  justify?: React.CSSProperties["justifyContent"];
}

// A single-row of single-character boxes for entering a fixed-length code
// (used for both the Secure ID and the referral code). Always stays on one
// line, auto-advances focus forward on type and backward on
// backspace-into-empty, and reports back the assembled string on every change.
export function CodeBoxes({ length, value, onChange, boxSize = 19, autoFocusFirst, justify = "center" }: CodeBoxesProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const chars = value.split("");

  const setChar = (i: number, c: string) => {
    const next = value.split("");
    while (next.length < length) next.push("");
    next[i] = c;
    onChange(next.join("").slice(0, length).replace(/\s+$/, (m) => m));
  };

  const handleChange = (i: number, raw: string) => {
    const c = raw.slice(-1);
    setChar(i, c);
    if (c && i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !chars[i] && i > 0) {
      refs.current[i - 1]?.focus();
    }
  };

  return (
    <div style={{ display: "flex", flexWrap: "nowrap", gap: 3, justifyContent: justify, overflowX: "auto" }}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
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

interface LabeledCodeRowProps {
  label: string;
  length: number;
  value: string;
  onChange: (next: string) => void;
  autoFocusFirst?: boolean;
}

// A code-entry row with its label sitting to the left of the boxes, outside
// them, instead of floating above as a badge. Used for the Secure ID and
// Referral ID steps.
export function LabeledCodeRow({ label, length, value, onChange, autoFocusFirst }: LabeledCodeRowProps) {
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

interface SubmitButtonProps {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}

// The pill-style "Submit" / "Continue" button shared by the Secure ID,
// Referral, and PIN steps. Disabled (greyed, non-interactive) until the
// field it belongs to is fully filled in.
export function SubmitButton({ onClick, disabled, label = "Submit" }: SubmitButtonProps) {
  return (
    <button
      type="button"
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
        touchAction: "manipulation",
      }}
    >
      {label}
    </button>
  );
}

interface SymbolChipRowProps {
  length: number;
  value: string;
  masked?: boolean;
}

// A read-only display of the symbols entered so far for Secure ID /
// Referral ID — chips instead of a live text input, since neither field
// should ever bring up the system keyboard. The dial that fills these in
// is always visible below the card now, so this is just a display. When
// `masked` is true, filled slots show a dot instead of the real symbol —
// paired with the eye button next to it. No inline label here — that
// lives on the card's boundary (the "Secure ID" / "Referral ID" corner
// badge) instead, so the full row width goes to chips + the eye button.
export function SymbolChipRow({ length, value, masked }: SymbolChipRowProps) {
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
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexWrap: "nowrap", gap: 3, overflowX: "auto" }}>
        {Array.from({ length }).map((_, i) => {
          // Entered chars always come from the 8-symbol dial, but the type
          // system can't know that from a plain string — narrow it here,
          // once, rather than loosening SYMBOL_COLORS's key type everywhere.
          const isKnownSymbol = (s: string): s is DialSymbol => s in SYMBOL_COLORS;
          const ch = chars[i];
          return (
            <span
              key={i}
              style={{
                width: 21,
                height: 21 * 1.2,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
                fontWeight: 800,
                color: ch && !masked && isKnownSymbol(ch) ? SYMBOL_COLORS[ch] : T.ink,
                background: ch ? T.accentSoft : T.surfaceAlt,
                border: "1.5px solid " + (ch ? T.accent : T.line),
                borderRadius: 9,
                transition: "border-color 0.15s ease, background 0.15s ease",
              }}
            >
              {ch ? (masked ? "•" : ch) : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}

interface MaskEyeIconProps {
  open: boolean;
  color: string;
}

// Small show/hide toggle icon, used next to the Secure ID / Referral ID
// chip rows to reveal or mask the entered symbols.
export function MaskEyeIcon({ open, color }: MaskEyeIconProps) {
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
