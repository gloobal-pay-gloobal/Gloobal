import React, { useState } from "react";
import { FlagEmoji } from "../../components/icons/MiscIcons";
import { RegistrationScreenHeader } from "../../components/common/RegistrationScreenHeader";
import { countryMatches } from "../../data/countries";
import { T } from "../../styles/theme";
import { Search } from "lucide-react";
import type { Country } from "../../types";

interface CountryPickerScreenProps {
  topCountries: Country[];
  countries: Country[];
  search: string;
  onSearch: (next: string) => void;
  onSelect: (country: Country) => void;
  onClose: () => void;
}

// Full-screen "new screen" overlay: a search bar up top and a scrollable
// list below it. With no search typed, it shows the curated top 50 plus a
// "See all countries" expander; typing a search always searches everything.
export function CountryPickerScreen({ topCountries, countries, search, onSearch, onSelect, onClose }: CountryPickerScreenProps) {
  const [expanded, setExpanded] = useState(false);
  const q = search.trim().toLowerCase();
  const filtered = q
    ? countries.filter((c) => countryMatches(c, search))
    : expanded
    ? countries
    : topCountries;

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
      <RegistrationScreenHeader onBack={onClose} backLabel="Close">
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 9,
            background: T.surfaceAlt,
            borderRadius: T.radiusMd,
            padding: "11px 14px",
            border: `1px solid ${T.line}`,
          }}
        >
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke={T.inkFaint} strokeWidth="2.4">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input
            autoFocus
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search country or code"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "none",
              fontSize: 14,
              color: T.ink,
              fontWeight: 500,
            }}
          />
        </div>
      </RegistrationScreenHeader>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px 24px" }}>
        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: "center", color: T.inkFaint, fontSize: 13 }}>
            No countries found
          </div>
        )}

        {!q && filtered.length > 0 && (
          <>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: 10,
              }}
            >
              {filtered.map((c) => (
                <button
                  key={c.iso}
                  onClick={() => onSelect(c)}
                  title={`${c.name} (${c.dialCode})`}
                  aria-label={`${c.name}, ${c.dialCode}`}
                  className="v2-tap"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "6px 2px",
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                  }}
                >
                  <FlagEmoji
                    flag={c.flag}
                    size={48}
                    radius={T.radiusSm}
                    background={T.surface}
                    dropShadow="drop-shadow(0 2px 6px rgba(76,29,149,0.10))"
                  />
                </button>
              ))}
            </div>

            {!expanded && (
              <button
                onClick={() => setExpanded(true)}
                className="v2-tap"
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 18,
                  border: `1px solid ${T.line}`,
                  background: T.surface,
                  borderRadius: T.radiusMd,
                  padding: "13px 0",
                  color: T.accent,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: T.shadowCard,
                }}
              >
                Total Users
              </button>
            )}
          </>
        )}

        {q && filtered.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {filtered.map((c) => (
              <button
                key={c.iso}
                onClick={() => onSelect(c)}
                className="v2-row"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "11px 12px",
                  border: "none",
                  background: T.surface,
                  textAlign: "left",
                  cursor: "pointer",
                  borderRadius: T.radiusMd,
                }}
              >
                <FlagEmoji flag={c.flag} size={30} radius={9} dropShadow="drop-shadow(0 1px 3px rgba(76,29,149,0.12))" />
                <span style={{ flex: 1, fontSize: 14, color: T.ink, fontWeight: 600 }}>
                  {c.name}
                </span>
                <span style={{ fontSize: 13, color: T.inkFaint, fontWeight: 600 }}>{c.dialCode}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
