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
import { Flag, FlagEmoji, countryGlowStyle } from "../common/FlagComponents";
import { ALL_COUNTRIES, COUNTRY_BY_ISO, countryMatches, isoToFlag } from "../../constants/countries";
import { COVERAGE_ALL_COUNTRIES, COVERAGE_COUNTRIES, fmtTime, fmtUsers, fmtVolume, loadStoredCoverageCountry, saveStoredCoverageCountry } from "../../constants/coverage";
import { useAmbientFlags } from "../../hooks/useAmbientFlags";
import { C } from "../../styles/theme";

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

/* ---------- Data ---------- */
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
  const cardRefs = useRef({});
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
    cardRefs.current[code]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
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

        {/* Hero box — every country's flag flowing, registration-screen
            style (same growth/twinkle/shape-mask physics), just brighter
            since it's the main event here instead of a faint backdrop. */}
        <div className="mt-1 px-5">
          <div className="relative rounded-2xl overflow-hidden" style={{ height: 320, background: "#FFFFFF", border: `1px solid ${C.line}` }}>
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(60% 60% at 50% 40%, rgba(124,58,237,0.08) 0%, rgba(124,58,237,0) 70%)" }}
            />
            <FlagFlowBox opacityBoost={2.4} />
            <div
              className="absolute top-3 right-3 flex flex-col gap-2 rounded-2xl px-3 py-2.5"
              style={{
                background: "rgba(255,255,255,0.85)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                border: `1px solid ${C.line}`,
                boxShadow: "0 8px 20px rgba(20,20,40,0.1)",
              }}
            >
              <div className="flex items-center gap-1.5">
                <Users2 size={13} style={{ color: C.accent }} />
                <span className="mono text-[12px] font-semibold" style={{ color: C.ink }}>{fmtUsers(totalLiveUsers)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Globe2 size={13} style={{ color: C.accent }} />
                <span className="mono text-[12px] font-semibold" style={{ color: C.ink }}>{COVERAGE_COUNTRIES.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Full-page detail — flips in once a country is picked below:
            its flag at full size and its top stats, or a reassuring note
            if it's not live here yet. */}
        {flipped && (
          <div className="coverage-detail-overlay" style={{ position: "fixed", inset: 0, zIndex: 280, background: C.surface }}>
            <div className="flex items-center justify-between px-5" style={{ paddingTop: "calc(20px + env(safe-area-inset-top, 0px))" }}>
              <button
                onClick={() => setFlipped(false)}
                aria-label="Back to flag wall"
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: C.bgSoft, border: `1px solid ${C.line}` }}
              >
                <ChevronLeft size={18} style={{ color: C.ink }} />
              </button>
            </div>

            <div className="px-6" style={{ paddingTop: "6%" }}>
              <div className="flex items-start gap-4">
                <div
                  className="relative flex-shrink-0"
                  style={{ width: 88, height: 64, borderRadius: 18, ...countryGlowStyle(isActive) }}
                >
                  <div className="absolute inset-0 rounded-2xl overflow-hidden">
                    <CoverageFlag code={country.code} width={88} height={64} />
                  </div>
                </div>
                <div className="flex-1 min-w-0" style={{ paddingTop: 8 }}>
                  <div className="display font-bold text-xl" style={{ color: C.ink }}>{country.name}</div>
                </div>
              </div>

              {isActive ? (
                <div className="w-full mt-7 flex flex-col gap-3">
                  <div className="flex items-center justify-between rounded-2xl px-4 py-4" style={{ background: C.bgSoft }}>
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
                  <div className="flex items-center justify-between rounded-2xl px-4 py-4" style={{ background: C.bgSoft }}>
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
                  <div className="flex items-center justify-between rounded-2xl px-4 py-4" style={{ background: C.bgSoft }}>
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
                <div className="w-full mt-7 rounded-2xl px-5 py-6 text-center" style={{ background: C.bgSoft }}>
                  <div className="text-sm font-semibold" style={{ color: C.ink }}>Don't worry — we're in this together.</div>
                  <div className="text-xs mt-1.5" style={{ color: C.inkSoft }}>{country.name} isn't live for transfers yet, but coverage keeps growing.</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Flag strip: flags only — tap picks a country and flips the box above */}
        <div className="mt-4 pb-8">
          {filteredCoverage.length === 0 ? (
            <div className="px-5 py-6 flex justify-center">
              <Search size={18} style={{ color: C.inkFaint }} />
            </div>
          ) : (
            <div className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-1 snap-x snap-mandatory">
              {filteredCoverage.map((c) => {
                const isSel = c.code === selected;
                return (
                  <button
                    key={c.code}
                    ref={(el) => (cardRefs.current[c.code] = el)}
                    onClick={() => selectCountry(c.code)}
                    aria-label={c.name}
                    className="snap-center flex-shrink-0"
                  >
                    <div
                      className="relative rounded-xl overflow-hidden"
                      style={{ width: 56, height: 40, border: isSel ? `2px solid ${C.accent}` : `1px solid ${C.line}`, boxShadow: isSel ? '0 6px 16px rgba(124,58,237,0.22)' : 'none', opacity: c.active ? 1 : 0.4 }}
                    >
                      <CoverageFlag code={c.code} width={56} height={40} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// Memoized for the same reason as DashboardScreen — see that file's note.
export const GloobalCoverageScreen = React.memo(GloobalCoverageScreenBase);
