import React, { useState } from "react";
import {
  Users2,
} from "lucide-react";
import { FlagEmoji, countryGlowStyle } from "../common/FlagComponents";
import { countryMatches } from "../../constants/countries";
import { COVERAGE_COUNTRIES_RAW, fmtUsers } from "../../constants/coverage";
import { T } from "../../styles/theme";

// Full-screen "new screen" overlay: a search bar up top and a scrollable
// list below it. With no search typed, it shows the curated top 50 plus a
// "See all countries" expander; typing a search always searches everything.
export function CountryPickerScreen({ topCountries, countries, search, onSearch, onSelect, onClose }) {
  const [expanded, setExpanded] = useState(false);
  const q = search.trim().toLowerCase();
  const filtered = q
    ? countries.filter((c) => countryMatches(c, search))
    : expanded
    ? countries
    : topCountries;
  // India is the only country with real coverage/user data behind it right
  // now, so it's the only one that gets a real number under its flag.
  const indiaUsers = COVERAGE_COUNTRIES_RAW.find((x) => x.code === "IN")?.baseUsers || 0;

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
            transition: "background 0.15s ease, transform 0.1s ease",
          }}
          aria-label="Close"
        >
          ‹
        </button>
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
      </div>

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
                gap: 12,
              }}
            >
              {filtered.map((c) => {
                // Only India has real coverage/user data behind it right
                // now, so it's the only flag that glows green with a real
                // user count; every other country glows red with a null
                // placeholder instead of a made-up number.
                const isActive = c.iso === "IN";
                return (
                  <button
                    key={c.iso}
                    onClick={() => onSelect(c)}
                    title={`${c.name} (${c.dialCode})`}
                    aria-label={`${c.name}, ${c.dialCode}${isActive ? `, ${fmtUsers(indiaUsers)} users` : ""}`}
                    className="v2-tap"
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 5,
                      padding: "4px 2px",
                      border: "none",
                      background: "none",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ position: "relative", width: 42, height: 42, borderRadius: T.radiusSm, ...countryGlowStyle(isActive, true) }}>
                      <div style={{ position: "absolute", inset: 0, borderRadius: T.radiusSm, overflow: "hidden" }}>
                        <FlagEmoji flag={c.flag} size={42} background={T.surface} />
                      </div>
                    </div>
                    <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 9.5, fontWeight: 700, color: isActive ? T.ink : T.inkFaint }}>
                      <Users2 size={9} color={isActive ? T.accent : T.inkFaint} />
                      {isActive ? fmtUsers(indiaUsers) : "—"}
                    </span>
                  </button>
                );
              })}
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
                See all countries
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
