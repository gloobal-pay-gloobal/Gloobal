import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  Search,
  Zap,
  X,
  Globe2,
  Activity,
  Users2,
  ArrowUp,
  ArrowDown,
  RefreshCw,
} from "lucide-react";
import { FlagFlowBox } from "../backgrounds/FlagParticleField";
import { Flag, FlagEmoji, FlagSignShape, countryGlowStyle } from "../common/FlagComponents";
import { ALL_COUNTRIES, COUNTRY_BY_ISO, countryMatches, isoToFlag } from "../../constants/countries";
import { COVERAGE_ALL_COUNTRIES, COVERAGE_COUNTRIES, fmtTime, fmtUsers, fmtVolume, loadStoredCoverageCountry, saveStoredCoverageCountry } from "../../constants/coverage";
import { useAmbientFlags } from "../../hooks/useAmbientFlags";
import { C } from "../../styles/theme";
import { ChevronRight } from "lucide-react";

// Gloobal Coverage's flags now use the exact same full-fit flag renderer
// (FlagEmoji) as registration, the dashboard, and Send Money — no more
// separate hand-drawn SVG flags or a second, uncropped emoji fallback.
// Every coverage country's flag comes from COUNTRY_BY_ISO, the single
// country dataset, so it's guaranteed to be the same flag shown everywhere
// else for that country.
export function CoverageFlag({ code, width, height }) {
  const flag = COUNTRY_BY_ISO[code]?.flag || isoToFlag(code);
  return <FlagEmoji flag={flag} width={width} height={height} />;
}

function GloobalCoverageScreenBase({ onClose, dialCountry }) {
  // First launch: use the detected/registered country, or a default if
  // unavailable. After that, whatever the person last picked here wins —
  // persisted below whenever selectCountry() runs — so the screen reopens
  // centered on their last choice instead of always resetting.
  const [selected, setSelected] = useState(() => {
    const stored = loadStoredCoverageCountry();
    if (stored) return stored;
    return dialCountry ? dialCountry.iso : 'PK';
  });
  const [data, setData] = useState(() => Object.fromEntries(COVERAGE_COUNTRIES.map((c) => [c.code, {
    volume: c.baseVolume, tps: c.baseTps, users: c.baseUsers,
    prevVolume: c.baseVolume, prevTps: c.baseTps, prevUsers: c.baseUsers,
  }])));
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [countryQuery, setCountryQuery] = useState('');
  // The hero box starts as a flowing wall of every country's flag; picking
  // one from the strip below flips it over to that country's own flag,
  // large, with its live transaction data on the back.
  const [flipped, setFlipped] = useState(false);
  const ambientFlags = useAmbientFlags();

  // Gloobal Coverage now searches/browses the exact same complete country
  // list as the Registration country picker (COVERAGE_ALL_COUNTRIES is
  // ALL_COUNTRIES decorated with active/inactive), using the same shared
  // search predicate, so matching and ordering are identical everywhere a
  // country is searched.
  const filteredCoverage = useMemo(() => {
    if (!countryQuery.trim()) return COVERAGE_ALL_COUNTRIES;
    return COVERAGE_ALL_COUNTRIES.filter((c) => countryMatches(c, countryQuery));
  }, [countryQuery]);

  // Nine countries shown directly (three rows of three): the person's
  // own registration country pinned first, then the biggest live
  // countries by base user count (stable base figures, not the
  // live-wiggling numbers, so the grid never reshuffles). Everything
  // else lives behind the totals button.
  const top9 = useMemo(() => {
    const ownCode = dialCountry?.iso;
    const own = COVERAGE_ALL_COUNTRIES.find((x) => x.code === ownCode);
    const rest = [...COVERAGE_COUNTRIES]
      .sort((a, b) => b.baseUsers - a.baseUsers)
      .filter((c) => c.code !== ownCode)
      .slice(0, own ? 8 : 9)
      .map((c) => COVERAGE_ALL_COUNTRIES.find((x) => x.code === c.code))
      .filter(Boolean);
    return own ? [own, ...rest] : rest;
  }, [dialCountry]);

  // Whether the full every-country list is open (from the totals button).
  const [showAllCountries, setShowAllCountries] = useState(false);

  // Ref + measured width of the hero box: used to scroll the flip into
  // view on selection, and to size the constant center flag at 30% of
  // the box's width.
  const heroRef = useRef(null);
  const [heroW, setHeroW] = useState(350);
  useEffect(() => {
    const measure = () => setHeroW(heroRef.current?.offsetWidth || 350);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // If the current filter no longer includes the selected country, jump to
  // the first match so the hero/stats stay in sync with the search.
  useEffect(() => {
    if (filteredCoverage.length && !filteredCoverage.some((c) => c.code === selected)) {
      setSelected(filteredCoverage[0].code);
    }
  }, [filteredCoverage]);

  useEffect(() => {
    const id = setInterval(() => {
      setData((prev) => {
        const next = {};
        for (const c of COVERAGE_COUNTRIES) {
          const p = prev[c.code];
          const volume = Math.max(0.4, p.volume + (Math.random() - 0.42) * (c.baseVolume * 0.02));
          const tps = Math.max(40, Math.round(p.tps + (Math.random() - 0.42) * (c.baseTps * 0.04)));
          const users = Math.max(1000, Math.round(p.users + (Math.random() - 0.4) * (c.baseUsers * 0.003)));
          next[c.code] = { volume, tps, users, prevVolume: p.volume, prevTps: p.tps, prevUsers: p.users };
        }
        return next;
      });
      setLastUpdated(new Date());
    }, 2500);
    return () => clearInterval(id);
  }, []);

  // The selected country's identity (name/flag/active status) always comes
  // from the shared list; its live stats only exist if it's active.
  const country = COVERAGE_ALL_COUNTRIES.find((c) => c.code === selected) || COVERAGE_ALL_COUNTRIES[0];
  const isActive = !!country.active;
  const cd = isActive ? data[selected] : null;
  const volPct = cd?.prevVolume ? ((cd.volume - cd.prevVolume) / cd.prevVolume) * 100 : 0;
  const tpsPct = cd?.prevTps ? ((cd.tps - cd.prevTps) / cd.prevTps) * 100 : 0;
  const totalLiveUsers = useMemo(
    () => COVERAGE_COUNTRIES.reduce((sum, c) => sum + (data[c.code]?.users || 0), 0),
    [data]
  );

  function selectCountry(code) {
    setSelected(code);
    setFlipped(true);
    saveStoredCoverageCountry(code);
    // Bring the hero box into view so the flip is actually seen, even if
    // the person tapped from partway down the page or the full list.
    heroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  return (
    <div
      className="w-full font-sans"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 260,
        background: C.bgSoft,
        fontFamily: "'Inter', ui-sans-serif, system-ui",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
        .display { font-family: 'Space Grotesk', ui-sans-serif, system-ui; }
        @keyframes pulseRing { 0% { transform: scale(0.6); opacity: 0.55; } 70% { transform: scale(2.6); opacity: 0; } 100% { transform: scale(2.6); opacity: 0; } }
        @keyframes livePulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes ambientDrift { 0% { transform: translate(0px, 0px); opacity: 0.05; } 50% { transform: translate(var(--dx), var(--dy)); opacity: 0.13; } 100% { transform: translate(0px, 0px); opacity: 0.05; } }

        @keyframes detailFlipIn {
          from { transform: perspective(1400px) rotateY(-90deg); opacity: 0; }
          to { transform: perspective(1400px) rotateY(0deg); opacity: 1; }
        }
        .coverage-detail-overlay { animation: detailFlipIn 0.5s cubic-bezier(0.22, 1, 0.36, 1); transform-origin: center; }

        @media (prefers-reduced-motion: reduce) {
          .pulse-ring, .live-dot, .ambient-flag { animation: none !important; }
          .coverage-detail-overlay { animation: none; }
        }
      `}</style>

      {/* Ambient background: slow-drifting, low-opacity flags — purely
          decorative, never intercepts taps, sits behind everything else. */}
      <div aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
        {ambientFlags.map((f, i) => (
          <span
            key={i}
            className="ambient-flag"
            style={{
              position: "absolute",
              top: `${f.top}%`,
              left: `${f.left}%`,
              fontSize: f.size,
              lineHeight: 1,
              filter: "grayscale(20%)",
              willChange: "transform, opacity",
              animation: `ambientDrift ${f.duration}s ease-in-out ${f.delay}s infinite`,
              "--dx": `${f.dx}px`,
              "--dy": `${f.dy}px`,
            }}
          >
            {f.flag}
          </span>
        ))}
      </div>

      <div className="relative w-full" style={{ background: "transparent", minHeight: "100%", zIndex: 1 }}>
        {/* Header — the search field itself is the header now */}
        <div className="flex items-center gap-2.5 px-5 pt-6 pb-4">
          <button
            aria-label="Go back"
            onClick={onClose}
            className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: C.accentDeep, color: '#fff' }}
          >
            <ChevronLeft size={18} />
          </button>
          <div
            className="flex-1 flex items-center gap-2 rounded-2xl px-4 py-2.5"
            style={{ background: C.surface, border: `1px solid ${C.line}` }}
          >
            <Search size={15} style={{ color: C.inkFaint, flexShrink: 0 }} />
            <input
              value={countryQuery}
              onChange={(e) => setCountryQuery(e.target.value)}
              placeholder="Country"
              aria-label="Search Gloobal Coverage by country"
              className="flex-1 min-w-0 bg-transparent outline-none text-sm"
              style={{ color: C.ink }}
            />
            {countryQuery && (
              <button
                onClick={() => setCountryQuery('')}
                aria-label="Clear search"
                className="flex-shrink-0"
              >
                <X size={14} style={{ color: C.inkFaint }} />
              </button>
            )}
          </div>
        </div>

        {/* Hero box — the flag flow by default; once a country is picked
            below it flips to that country's flag at the full size of this
            same smooth-edged rectangle. Tapping the big flag flips back. */}
        <div className="mt-1 px-5">
          <div ref={heroRef} className="relative rounded-3xl overflow-hidden" style={{ height: 200, background: "#FFFFFF", border: `1px solid ${C.line}` }}>
            {flipped ? (
              <button
                onClick={() => setFlipped(false)}
                aria-label={`${country.name} — tap to go back to the flag wall`}
                className="coverage-detail-overlay absolute inset-0"
                style={{ border: "none", padding: 0, background: "none", cursor: "pointer" }}
              >
                {/* Same flow concept as the idle wall, but every particle
                    is this one country's flag — still masked into the
                    +, −, ×, =, ○, ▢ symbol shapes — drifting at varied
                    speeds (slower overall, some lazy, some quick). The
                    key remounts the flow per country so it reseeds
                    instantly with the right flag. */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: "radial-gradient(60% 60% at 50% 40%, rgba(124,58,237,0.08) 0%, rgba(124,58,237,0) 70%)" }}
                />
                <FlagFlowBox key={country.code} opacityBoost={2.4} onlyFlag={country.flag} varied />
                {/* One constant anchor at the center — the country's flag
                    held still in a circle, sized at 30% of the box,
                    while the rest of the flow drifts on around it. */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 2 }}>
                  <div style={{ filter: "drop-shadow(0 6px 18px rgba(20,18,43,0.28))" }}>
                    <FlagSignShape sign="circle" flag={country.flag} box={Math.round(heroW * 0.3)} />
                  </div>
                </div>
              </button>
            ) : (
              <>
                <div
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: "radial-gradient(60% 60% at 50% 40%, rgba(124,58,237,0.08) 0%, rgba(124,58,237,0) 70%)" }}
                />
                <FlagFlowBox opacityBoost={2.4} />
              </>
            )}
          </div>
        </div>

        {/* Selected country's data — directly below the big flag. */}
        {flipped && (
          <div className="px-5 mt-4">
            <div className="flex items-center justify-between">
              <span className="display font-bold text-lg" style={{ color: C.ink }}>{country.name}</span>
              <span className="text-[11px] font-semibold" style={{ color: isActive ? C.positive : C.inkFaint }}>
                {isActive ? "Live" : "Coming soon"}
              </span>
            </div>

            {isActive ? (
              <div className="w-full mt-3 flex flex-col gap-3">
                <div className="flex items-center justify-between rounded-2xl px-4 py-4" style={{ background: "#FFFFFF", border: `1px solid ${C.line}` }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: C.accentSoft }}>
                      <Activity size={16} style={{ color: C.accent }} />
                    </div>
                    <span className="text-sm font-semibold" style={{ color: C.ink }}>Volume</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="mono font-bold text-base" style={{ color: C.accent }}>{fmtVolume(cd.volume)}</span>
                    {volPct >= 0 ? <ArrowUp size={12} style={{ color: C.positive }} /> : <ArrowDown size={12} style={{ color: C.negative }} />}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-2xl px-4 py-4" style={{ background: "#FFFFFF", border: `1px solid ${C.line}` }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: C.positiveSoft }}>
                      <Zap size={16} style={{ color: C.positive }} />
                    </div>
                    <span className="text-sm font-semibold" style={{ color: C.ink }}>Transactions / sec</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="mono font-bold text-base" style={{ color: C.positive }}>{cd.tps.toLocaleString()}</span>
                    {tpsPct >= 0 ? <ArrowUp size={12} style={{ color: C.positive }} /> : <ArrowDown size={12} style={{ color: C.negative }} />}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-2xl px-4 py-4" style={{ background: "#FFFFFF", border: `1px solid ${C.line}` }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: C.accentSoft }}>
                      <Users2 size={16} style={{ color: C.accent }} />
                    </div>
                    <span className="text-sm font-semibold" style={{ color: C.ink }}>Live users</span>
                  </div>
                  <span className="mono font-bold text-base" style={{ color: C.ink }}>{fmtUsers(cd.users)}</span>
                </div>
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <RefreshCw size={11} style={{ color: C.inkFaint }} />
                  <span className="text-[11px]" style={{ color: C.inkFaint }}>Updated {fmtTime(lastUpdated)}</span>
                </div>
              </div>
            ) : (
              <div className="w-full mt-3 rounded-2xl px-5 py-6 text-center" style={{ background: "#FFFFFF", border: `1px solid ${C.line}` }}>
                <div className="text-sm font-semibold" style={{ color: C.ink }}>Don&apos;t worry — we&apos;re in this together.</div>
                <div className="text-xs mt-1.5" style={{ color: C.inkSoft }}>{country.name} isn&apos;t live for transfers yet, but coverage keeps growing.</div>
              </div>
            )}
          </div>
        )}

        {/* Flag grid: top 20 countries shown directly (search results when
            searching) — tap picks a country and flips into its detail.
            Hidden entirely while a country's big flag is showing, so the
            page is just: big flag → its data → totals button. */}
        {!flipped && (
        <div className="mt-4">
          {(countryQuery.trim() ? filteredCoverage : top9).length === 0 ? (
            <div className="px-5 py-6 flex justify-center">
              <Search size={18} style={{ color: C.inkFaint }} />
            </div>
          ) : (
            <div
              className="px-5"
              style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, justifyItems: "center" }}
            >
              {(countryQuery.trim() ? filteredCoverage : top9).map((c) => {
                const isSel = c.code === selected;
                // Three per row, small chips centered in each column —
                // the totals box below carries the visual weight instead.
                const flagW = 84;
                const flagH = 60;
                return (
                  <button
                    key={c.code}
                    onClick={() => selectCountry(c.code)}
                    aria-label={c.name}
                    className="flex-shrink-0"
                  >
                    <div
                      className="relative rounded-xl overflow-hidden"
                      style={{ width: flagW, height: flagH, border: isSel ? `2px solid ${C.accent}` : `1px solid ${C.line}`, boxShadow: isSel ? '0 6px 16px rgba(124,58,237,0.22)' : 'none', opacity: c.active ? 1 : 0.4 }}
                    >
                      <CoverageFlag code={c.code} width={flagW} height={flagH} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        )}

        {/* Totals button — the users/countries figures that used to sit
            inside the hero box now live here; tapping opens the whole
            country list. */}
        <div className="mt-5 px-5 pb-8">
          <button
            onClick={() => setShowAllCountries(true)}
            aria-label="See all countries"
            className="w-full flex items-stretch rounded-2xl"
            style={{ background: C.surface, border: `1px solid ${C.line}`, boxShadow: "0 2px 10px rgba(20,18,43,0.05)", cursor: "pointer", padding: "22px 14px", position: "relative" }}
          >
            <span className="flex-1 flex flex-col items-center gap-2">
              <span
                className="flex items-center justify-center"
                style={{ width: 48, height: 48, borderRadius: 16, background: "rgba(124,58,237,0.09)" }}
              >
                <Users2 size={24} style={{ color: C.accent }} />
              </span>
              <span className="mono font-bold text-[17px]" style={{ color: C.ink }}>{fmtUsers(totalLiveUsers)}</span>
            </span>
            <span aria-hidden="true" style={{ width: 1, background: C.line, alignSelf: "stretch" }} />
            <span className="flex-1 flex flex-col items-center gap-2">
              <span
                className="flex items-center justify-center"
                style={{ width: 48, height: 48, borderRadius: 16, background: "rgba(124,58,237,0.09)" }}
              >
                <Globe2 size={24} style={{ color: C.accent }} />
              </span>
              <span className="mono font-bold text-[17px]" style={{ color: C.ink }}>{COVERAGE_ALL_COUNTRIES.length}</span>
            </span>
            <ChevronRight size={17} style={{ color: C.inkFaint, position: "absolute", top: 14, right: 14 }} />
          </button>
        </div>

        {/* The whole country list — every country, live and coming soon,
            opened from the totals button. Tapping a row selects it and
            flips into its detail. */}
        {showAllCountries && (
          <div style={{ position: "fixed", inset: 0, zIndex: 270, background: C.surface, display: "flex", flexDirection: "column" }}>
            <div className="flex items-center gap-2.5 px-5 pb-3" style={{ paddingTop: "calc(20px + env(safe-area-inset-top, 0px))", flexShrink: 0 }}>
              <button
                onClick={() => setShowAllCountries(false)}
                aria-label="Back"
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: C.bgSoft, border: `1px solid ${C.line}` }}
              >
                <ChevronLeft size={18} style={{ color: C.ink }} />
              </button>
              <div className="flex-1 min-w-0">
                <div className="display font-bold text-base" style={{ color: C.ink }}>All countries</div>
                <div className="text-[11.5px]" style={{ color: C.inkFaint }}>
                  {fmtUsers(totalLiveUsers)} users · {COVERAGE_COUNTRIES.length} live of {COVERAGE_ALL_COUNTRIES.length}
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-8" style={{ WebkitOverflowScrolling: "touch" }}>
              {COVERAGE_ALL_COUNTRIES.map((c, i) => (
                <button
                  key={c.code}
                  onClick={() => {
                    setShowAllCountries(false);
                    selectCountry(c.code);
                  }}
                  aria-label={c.name}
                  className="w-full flex items-center gap-3 py-2.5 text-left"
                  style={{ border: "none", borderTop: i === 0 ? "none" : `1px solid ${C.line}`, background: "none", cursor: "pointer" }}
                >
                  <div className="relative rounded-lg overflow-hidden flex-shrink-0" style={{ width: 40, height: 29, border: `1px solid ${C.line}`, opacity: c.active ? 1 : 0.45 }}>
                    <CoverageFlag code={c.code} width={40} height={29} />
                  </div>
                  <span className="flex-1 min-w-0 text-[13.5px] font-semibold truncate" style={{ color: C.ink }}>{c.name}</span>
                  <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: c.active ? C.positive : C.inkFaint }}>
                    {c.active ? "Live" : "Coming soon"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// Memoized for the same reason as DashboardScreen — see that file's note.
export const GloobalCoverageScreen = React.memo(GloobalCoverageScreenBase);
