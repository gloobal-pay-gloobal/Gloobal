import React from "react";
import { T } from "../../styles/theme";

// Single shared search-field look used by both DashboardScreen (as a
// tap-target that opens Global Coverage) and GlobalCoverageScreen (as the
// actual live filter input) — same size/radius/padding/shadow/icon/text
// everywhere it appears, per founder feedback that the two screens'
// search fields must be visually identical.
const DEFAULT_PLACEHOLDER = "Global Coverage, Country...";

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke={T.inkFaint} strokeWidth="2.4">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}

const fieldStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  gap: 8,
  background: T.surface,
  borderRadius: T.radiusMd,
  padding: "11px 15px",
  boxShadow: T.shadowCard,
  border: "none",
};

interface GlobalSearchFieldProps {
  /** Non-editable: renders as a button that hands off to `onClick` (Dashboard). */
  readOnly?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  onClear?: () => void;
  onClick?: () => void;
  placeholder?: string;
}

export function GlobalSearchField({
  readOnly = false,
  value = "",
  onChange,
  onClear,
  onClick,
  placeholder = DEFAULT_PLACEHOLDER,
}: GlobalSearchFieldProps) {
  if (readOnly) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Search Global Coverage by country"
        className="v2-tap"
        style={{ ...fieldStyle, cursor: "pointer", textAlign: "left", touchAction: "manipulation" }}
      >
        <SearchIcon />
        <span style={{ flex: 1, fontSize: 14, color: T.inkFaint, fontWeight: 500 }}>
          {placeholder}
        </span>
      </button>
    );
  }

  return (
    <div style={fieldStyle}>
      <SearchIcon />
      <input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        aria-label="Search Global Coverage by country"
        style={{
          flex: 1,
          minWidth: 0,
          background: "transparent",
          outline: "none",
          border: "none",
          fontSize: 14,
          color: T.ink,
          fontWeight: 500,
          fontFamily: "inherit",
        }}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          style={{ flexShrink: 0, border: "none", background: "none", cursor: "pointer", padding: 0, display: "flex" }}
        >
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={T.inkFaint} strokeWidth="2.4">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}
