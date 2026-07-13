import React, { useState, useEffect, useRef, useMemo } from "react";
import { useCoverageStats } from "../../api/coverage";
import { Flag } from "../../components/common/Flag";
import { GlobalSearchField } from "../../components/common/GlobalSearchField";
import { FlagEmoji } from "../../components/icons/MiscIcons";
import { ALL_COUNTRIES, COUNTRY_BY_ISO, countryMatches, isoToFlag } from "../../data/countries";
import { Activity, ArrowDown, ArrowUp, Bell, ChevronDown, ChevronLeft, Globe2, History, RefreshCw, Search, Users2, Zap } from "lucide-react";
import type { DialCountry } from "../../types";

/** Live/animated stats for one coverage country — current tick plus the
 * previous tick's values (used to compute the up/down % delta shown next
 * to volume and TPS). */
interface CoverageDatum {
  volume: number;
  tps: number;
  users: number;
  prevVolume: number;
  prevTps: number;
  prevUsers: number;
}


export const C = {
  bgSoft: '#F8F7FC',
  surface: '#FFFFFF',
  ink: '#1A1A2E',
  inkSoft: '#6B7280',
  inkFaint: '#9A94AD',
  accent: '#7C3AED',
  accentDeep: '#4C1D95',
  accentSoft: '#F4F2FB',
  positive: '#159A67',
  positiveSoft: '#E2F6EC',
  negative: '#D8483E',
  negativeSoft: '#FCEAE8',
  line: '#ECE7FB',
  dot: '#D8D2EE',
  // Premium dark map surface: navy/charcoal with a subtle blue gradient,
  // instead of the flat violet block used before.
  mapBg: 'linear-gradient(160deg, #0A0E1C 0%, #0E1A2E 45%, #101826 100%)',
  mapLand: 'rgba(148,163,184,0.28)',
  mapLandFaint: 'rgba(148,163,184,0.12)',
};

// Global Coverage's flags now use the exact same full-fit flag renderer
// (FlagEmoji) as registration, the dashboard, and Send Money — no more
// separate hand-drawn SVG flags or a second, uncropped emoji fallback.
// Every coverage country's flag comes from COUNTRY_BY_ISO, the single
// country dataset, so it's guaranteed to be the same flag shown everywhere
// else for that country.
export function CoverageFlag({ code, width, height }: { code: string; width: number; height: number }) {
  const flag = COUNTRY_BY_ISO[code]?.flag || isoToFlag(code);
  return <FlagEmoji flag={flag} width={width} height={height} />;
}

/* ---------- Data ---------- */
// Only the coverage-specific facts (geo position, rollout date, demo
// stats) live here. Country identity — name and flag — is not duplicated:
// it's looked up from COUNTRY_BY_ISO, the same single dataset the
// registration country picker uses, keyed by the same ISO-2 `code`.
export const COVERAGE_COUNTRIES_RAW = [
  { code: 'IN', lat: 20.5937,  lng: 78.9629,   integrated: 'Jan 2023', baseVolume: 12.45, baseTps: 1450, baseUsers: 2_450_000, zoom: 2.2 },
  { code: 'US', lat: 39.8283,  lng: -98.5795,  integrated: 'Nov 2022', baseVolume: 45.32, baseTps: 5200, baseUsers: 3_180_000, zoom: 1.8 },
  { code: 'GB', lat: 55.3781,  lng: -3.4360,   integrated: 'Feb 2023', baseVolume: 8.91,  baseTps: 980,  baseUsers: 540_000, zoom: 4.5 },
  { code: 'PK', lat: 30.3753,  lng: 69.3451,   integrated: 'Mar 2024', baseVolume: 8.32,  baseTps: 2145, baseUsers: 612_000, zoom: 3 },
  { code: 'CA', lat: 56.1304,  lng: -106.3468, integrated: 'May 2023', baseVolume: 5.67,  baseTps: 640,  baseUsers: 322_000, zoom: 1.5 },
  { code: 'DE', lat: 51.1657,  lng: 10.4515,   integrated: 'Jul 2023', baseVolume: 7.14,  baseTps: 810,  baseUsers: 410_000, zoom: 4 },
  { code: 'BR', lat: -14.2350, lng: -51.9253,  integrated: 'Sep 2023', baseVolume: 6.28,  baseTps: 730,  baseUsers: 483_000, zoom: 1.7 },
  { code: 'AE', lat: 23.4241,  lng: 53.8478,   integrated: 'Apr 2024', baseVolume: 4.02,  baseTps: 505,  baseUsers: 191_000, zoom: 5.5 },
  { code: 'CN', lat: 35.8617,  lng: 104.1954,  integrated: 'Jun 2023', baseVolume: 22.10, baseTps: 3100, baseUsers: 1_540_000, zoom: 1.7 },
  { code: 'JP', lat: 36.2048,  lng: 138.2529,  integrated: 'Aug 2023', baseVolume: 9.87,  baseTps: 1120, baseUsers: 602_000, zoom: 3.8 },
  { code: 'FR', lat: 46.6034,  lng: 1.8883,    integrated: 'Oct 2023', baseVolume: 6.94,  baseTps: 760,  baseUsers: 388_000, zoom: 4 },
  { code: 'IT', lat: 41.8719,  lng: 12.5674,   integrated: 'Dec 2023', baseVolume: 5.42,  baseTps: 605,  baseUsers: 301_000, zoom: 4.2 },
  { code: 'RU', lat: 61.5240,  lng: 105.3188,  integrated: 'Jan 2024', baseVolume: 4.88,  baseTps: 540,  baseUsers: 275_000, zoom: 1.2 },
  { code: 'KR', lat: 35.9078,  lng: 127.7669,  integrated: 'Feb 2024', baseVolume: 7.21,  baseTps: 820,  baseUsers: 356_000, zoom: 5 },
  { code: 'AU', lat: -25.2744, lng: 133.7751,  integrated: 'Mar 2024', baseVolume: 4.55,  baseTps: 490,  baseUsers: 228_000, zoom: 1.8 },
  { code: 'ES', lat: 40.4637,  lng: -3.7492,   integrated: 'May 2024', baseVolume: 4.19,  baseTps: 455,  baseUsers: 214_000, zoom: 4.3 },
  { code: 'MX', lat: 23.6345,  lng: -102.5528, integrated: 'Jun 2024', baseVolume: 5.03,  baseTps: 560,  baseUsers: 267_000, zoom: 2.8 },
  { code: 'ID', lat: -0.7893,  lng: 113.9213,  integrated: 'Jul 2024', baseVolume: 6.61,  baseTps: 705,  baseUsers: 349_000, zoom: 1.9 },
  { code: 'NL', lat: 52.1326,  lng: 5.2913,    integrated: 'Aug 2024', baseVolume: 3.42,  baseTps: 380,  baseUsers: 176_000, zoom: 5.5 },
  { code: 'SA', lat: 23.8859,  lng: 45.0792,   integrated: 'Sep 2024', baseVolume: 3.98,  baseTps: 420,  baseUsers: 199_000, zoom: 2.8 },
  { code: 'CH', lat: 46.8182,  lng: 8.2275,    integrated: 'Oct 2024', baseVolume: 3.10,  baseTps: 340,  baseUsers: 152_000, zoom: 6 },
  { code: 'TR', lat: 38.9637,  lng: 35.2433,   integrated: 'Nov 2024', baseVolume: 3.77,  baseTps: 400,  baseUsers: 187_000, zoom: 3.5 },
];

export const COVERAGE_COUNTRIES = COVERAGE_COUNTRIES_RAW.map((c) => ({
  ...c,
  name: COUNTRY_BY_ISO[c.code]?.name || c.code,
}));

// ISO codes that are actually live/integrated (have real coverage stats
// above). Everything else in the shared country list is "not available yet".
export const ACTIVE_ISO_SET = new Set(COVERAGE_COUNTRIES_RAW.map((c) => c.code));
export const COVERAGE_BY_ISO = Object.fromEntries(COVERAGE_COUNTRIES.map((c) => [c.code, c]));

// Global Coverage's search/browse list is now just the shared ALL_COUNTRIES
// dataset (same list, same order, same flags, same search predicate as the
// Registration country picker) with two extra facts merged in per country:
// whether it's live, and — only if live — its coverage stats/coordinates.
// This is the one and only country list Global Coverage uses.
export const COVERAGE_ALL_COUNTRIES = ALL_COUNTRIES.map((c) => {
  const code = c.iso;
  const live = ACTIVE_ISO_SET.has(code);
  return { ...c, code, active: live, coverage: live ? COVERAGE_BY_ISO[code] : null };
});

// Small green/live or red/inactive dot for the corner of a flag box. Reused
// everywhere a flag is shown in Global Coverage so there's one definition
// of what the indicator looks like and where it sits.
export function CoverageStatusDot({ active, size = 12 }: { active: boolean; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className={active ? "live-dot" : undefined}
      style={{
        position: "absolute",
        top: -size * 0.28,
        right: -size * 0.28,
        width: size,
        height: size,
        borderRadius: "50%",
        background: active ? C.positive : C.negative,
        border: `2px solid ${C.surface}`,
        boxShadow: "0 1px 3px rgba(20,20,40,0.25)",
        animation: active ? "livePulse 1.8s ease-in-out infinite" : "none",
      }}
    />
  );
}

export function fmtVolume(v: number) { return `$${v.toFixed(2)}M+`; }
export function fmtUsers(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}
export function fmtTime(d: Date) { return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }

// Remembers which country the person last picked on this screen, so it
// reopens centered on that choice instead of always resetting — the web
// equivalent of AsyncStorage. Wrapped in try/catch since localStorage can
// throw (private browsing, storage disabled); the screen still works
// fine without it, it just won't remember the choice in that case.
export const COVERAGE_COUNTRY_STORAGE_KEY = "gloobal.coverage.selectedCountry";
export function loadStoredCoverageCountry(): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(COVERAGE_COUNTRY_STORAGE_KEY) : null;
  } catch {
    return null;
  }
}
export function saveStoredCoverageCountry(code: string) {
  try {
    if (typeof window !== "undefined") window.localStorage.setItem(COVERAGE_COUNTRY_STORAGE_KEY, code);
  } catch {
    /* ignore — persistence is a nice-to-have, not a requirement */
  }
}

// A handful of country flags that gently drift/fade behind the map as
// ambient decoration. Purely visual — computed once and animated with CSS
// (transform + opacity only) so it stays smooth without per-frame JS.
export const AMBIENT_FLAG_CODES = ['US', 'BR', 'IN', 'JP', 'FR', 'DE', 'GB', 'AU', 'CA', 'ZA', 'MX', 'KR', 'ES', 'AE'];
export function useAmbientFlags() {
  return useMemo(
    () =>
      AMBIENT_FLAG_CODES.map((code, i) => ({
        code,
        flag: COUNTRY_BY_ISO[code]?.flag || isoToFlag(code),
        top: (i * 37) % 92 + 2,
        left: (i * 53) % 90 + 2,
        size: 24 + ((i * 7) % 5) * 6,
        duration: 24 + ((i * 5) % 6) * 3,
        delay: -((i * 11) % 20),
        dx: ((i % 2 === 0 ? 1 : -1) * (18 + (i % 4) * 6)),
        dy: ((i % 3 === 0 ? -1 : 1) * (14 + (i % 5) * 5)),
      })),
    []
  );
}

// ---------------------------------------------------------------------
// Hero panel geometry — a stylized (not geographically precise) India
// silhouette used only for the light "Global Coverage" hero card at the
// top of the screen. This is a decorative brand panel, independent of
// the searchable per-country picker (flag strip + live stats card)
// further down, which still runs on `selected`/`data` as before.
//
// The canvas is wider than the landmass itself (320 vs the path's own
// ~210) so the fan of connection lines has room to spread well past the
// silhouette on both sides, matching the founder's reference — the path
// is re-centered into that wider canvas via INDIA_HERO_OFFSET_X rather
// than redrawn.
// ---------------------------------------------------------------------
// A kite-shaped silhouette (wide north, small NE panhandle, west-coast
// bulge, narrowing to a peninsula point in the south) — still stylized,
// but reads as "India" rather than the previous rounded blob. Own
// bounding box is x:18-178, y:6-258 (160 x 252) — the offsets below
// re-center that into the wider, taller canvas with real top/bottom
// margin instead of sitting edge-to-edge.
export const INDIA_HERO_VB = { w: 320, h: 280 };
export const INDIA_HERO_OFFSET_X = 62;
export const INDIA_HERO_OFFSET_Y = 8;
export const INDIA_HERO_PATH =
  "M95,8 C110,8 122,14 130,26 C138,20 150,22 158,32 C152,42 145,48 148,58 " +
  "C158,62 172,64 175,78 C178,92 168,100 172,112 C176,124 168,130 160,140 " +
  "C152,150 150,162 152,175 C154,188 148,198 138,206 C128,214 122,224 118,236 " +
  "C114,248 106,256 96,258 C90,246 92,232 84,224 C76,216 68,214 62,204 " +
  "C56,194 60,182 52,174 C44,166 38,168 34,156 C30,144 38,136 32,126 " +
  "C26,116 18,112 20,100 C22,88 32,84 30,72 C28,60 36,54 34,42 " +
  "C32,30 44,24 52,16 C60,10 72,6 82,6 C87,6 91,7 95,8 Z";
export const INDIA_HERO_SRI_LANKA = { x: 110, y: 268 };

function heroArc(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const offset = Math.min(dist * 0.3, 55);
  const nx = -dy / dist;
  const ny = dx / dist;
  return `M ${x1},${y1} Q ${mx + nx * offset},${my + ny * offset} ${x2},${y2}`;
}

// Glowing "city" nodes scattered across the landmass — both a visual
// accent on their own and the set of arc origins below. Coordinates are
// already in the wide 320-unit canvas, pre-shifted by both
// INDIA_HERO_OFFSET_X and INDIA_HERO_OFFSET_Y (unlike INDIA_HERO_PATH,
// which gets shifted at render time via a <g transform> instead).
export const HERO_NODES = [
  { id: "delhi", x: 140, y: 48, color: "#8B5CF6" },
  { id: "mumbai", x: 108, y: 155, color: "#3B82F6" },
  { id: "kolkata", x: 200, y: 115, color: "#EC4899" },
  { id: "bangalore", x: 148, y: 215, color: "#22D3EE" },
  { id: "chennai", x: 172, y: 230, color: "#F59E0B" },
  { id: "jaipur", x: 115, y: 90, color: "#10B981" },
  { id: "lucknow", x: 163, y: 75, color: "#EF4444" },
];

// A ring of colorful glowing dots around the panel's edge — the "reaching
// the rest of the world" endpoints each connection line fans out to.
const HERO_RING_COLORS = ["#F59E0B", "#EC4899", "#3B82F6", "#22D3EE", "#8B5CF6", "#10B981", "#EF4444", "#FACC15"];
const HERO_RING_COUNT = 16;
export const HERO_OUTER_NODES = Array.from({ length: HERO_RING_COUNT }, (_, i) => {
  const angle = (360 / HERO_RING_COUNT) * i - 90;
  const rad = (angle * Math.PI) / 180;
  const cx = INDIA_HERO_VB.w / 2;
  const cy = INDIA_HERO_VB.h / 2 + 4;
  const rx = INDIA_HERO_VB.w / 2 - 6;
  const ry = INDIA_HERO_VB.h / 2 - 2;
  return {
    id: `ring-${i}`,
    x: cx + Math.cos(rad) * rx,
    y: cy + Math.sin(rad) * ry,
    color: HERO_RING_COLORS[i % HERO_RING_COLORS.length],
  };
});

// Each outer ring dot gets a curved line back to one of the landmass
// nodes, cycling through them — same fan-out look as the reference image,
// scaled up from the original single-hub version.
export const HERO_CONNECTIONS = HERO_OUTER_NODES.map((outer, i) => {
  const origin = HERO_NODES[i % HERO_NODES.length];
  return {
    id: `hc-${outer.id}`,
    d: heroArc(origin.x, origin.y, outer.x, outer.y),
    from: origin.color,
    to: outer.color,
    outer,
  };
});

// A dense scatter of small glowing dots across the landmass — the "city
// lights at night" texture. Deterministic pseudo-spread (same modulo
// trick as useAmbientFlags below) rather than Math.random, so the panel
// renders identically every time; clipped to the India silhouette via
// clipPath. Coordinates are in INDIA_HERO_PATH's own original (un-shifted)
// space, since this renders nested inside the same translated <g> as the
// landmass itself — not the wide 320-unit outer canvas.
const INDIA_HERO_LOCAL_VB = { w: 200, h: 262 };
export const HERO_STARFIELD = Array.from({ length: 220 }, (_, i) => ({
  x: (i * 29) % INDIA_HERO_LOCAL_VB.w,
  y: (i * 47) % INDIA_HERO_LOCAL_VB.h,
  size: 0.6 + ((i * 7) % 5) * 0.22,
  opacity: 0.3 + ((i * 13) % 6) * 0.09,
}));

export function GlobalCoverageScreen({ onClose, dialCountry }: { onClose: () => void; dialCountry?: DialCountry | null }) {
  // First launch: use the detected/registered country, or a default if
  // unavailable. After that, whatever the person last picked here wins —
  // persisted below whenever selectCountry() runs — so the screen reopens
  // centered on their last choice instead of always resetting.
  const [selected, setSelected] = useState<string>(() => {
    const stored = loadStoredCoverageCountry();
    if (stored) return stored;
    return dialCountry ? dialCountry.iso : 'PK';
  });
  const [data, setData] = useState<Record<string, CoverageDatum>>(() => Object.fromEntries(COVERAGE_COUNTRIES.map((c) => [c.code, {
    volume: c.baseVolume, tps: c.baseTps, users: c.baseUsers,
    prevVolume: c.baseVolume, prevTps: c.baseTps, prevUsers: c.baseUsers,
  }])));
  // Real analytics numbers, once a backend exists (see api/coverage.ts).
  // The static COVERAGE_COUNTRIES_RAW numbers above still seed initial
  // state and remain the fallback with no backend configured — this just
  // reseeds `data` in place the moment real stats resolve, so the
  // existing per-tick jitter/animation below keeps working unchanged on
  // top of real numbers instead of demo ones.
  const { stats: liveStats } = useCoverageStats();
  useEffect(() => {
    if (!liveStats || !liveStats.length) return;
    setData((prev) => {
      const next = { ...prev };
      for (const s of liveStats) {
        const p = prev[s.code] || { volume: s.volume, tps: s.tps, users: s.users };
        next[s.code] = { volume: s.volume, tps: s.tps, users: s.users, prevVolume: p.volume, prevTps: p.tps, prevUsers: p.users };
      }
      return next;
    });
  }, [liveStats]);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [countryQuery, setCountryQuery] = useState('');
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const ambientFlags = useAmbientFlags();

  // Global Coverage now searches/browses the exact same complete country
  // list as the Registration country picker (COVERAGE_ALL_COUNTRIES is
  // ALL_COUNTRIES decorated with active/inactive), using the same shared
  // search predicate, so matching and ordering are identical everywhere a
  // country is searched.
  const filteredCoverage = useMemo(() => {
    if (!countryQuery.trim()) return COVERAGE_ALL_COUNTRIES;
    return COVERAGE_ALL_COUNTRIES.filter((c) => countryMatches(c, countryQuery));
  }, [countryQuery]);

  // If the current filter no longer includes the selected country, jump to
  // the first match so the hero/map/stats stay in sync with the search.
  useEffect(() => {
    if (filteredCoverage.length && !filteredCoverage.some((c) => c.code === selected)) {
      setSelected(filteredCoverage[0].code);
    }
  }, [filteredCoverage]);

  useEffect(() => {
    const id = setInterval(() => {
      setData((prev) => {
        const next: Record<string, CoverageDatum> = {};
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

  function selectCountry(code: string) {
    setSelected(code);
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
        @media (prefers-reduced-motion: reduce) { .pulse-ring, .live-dot, .ambient-flag { animation: none !important; } }
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
            } as React.CSSProperties}
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
          <GlobalSearchField
            value={countryQuery}
            onChange={setCountryQuery}
            onClear={() => setCountryQuery('')}
          />
          <button aria-label="Notifications" className="relative w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
            <Bell size={17} style={{ color: C.ink }} />
            <span className="absolute top-2 right-2.5 w-1.5 h-1.5 rounded-full" style={{ background: C.negative }} />
          </button>
        </div>

        {/* Hero: light "Global Coverage" panel with a stylized India map —
            a decorative brand panel, separate from the searchable
            per-country picker (flag strip + live stats card below it,
            which still runs on `selected`/`data` exactly as before). */}
        <div className="mt-1 px-5">
          <div
            className="relative rounded-3xl overflow-hidden"
            style={{
              background: "linear-gradient(180deg, #FFFFFF 0%, #F7F5FF 100%)",
              border: "1px solid rgba(124,58,237,0.10)",
              boxShadow: "0 14px 34px rgba(76,29,149,0.10)",
              // Faint world-map dot-grid texture behind the India panel,
              // matching the reference's subtle background stipple.
              backgroundImage: "radial-gradient(rgba(124,58,237,0.16) 1px, transparent 1px)",
              backgroundSize: "13px 13px",
              backgroundPosition: "-4px -4px",
            }}
          >
            <div className="flex items-start justify-between px-4 pt-4">
              <div>
                <div className="display" style={{ fontSize: 18, fontWeight: 800, color: C.ink }}>
                  Global Coverage
                </div>
                <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2, maxWidth: 190, lineHeight: 1.35 }}>
                  Real-time overview of your global transactions
                </div>
              </div>
              <div
                className="flex items-center gap-1.5 rounded-full flex-shrink-0"
                style={{ background: C.surface, border: `1px solid ${C.line}`, boxShadow: "0 4px 12px rgba(76,29,149,0.08)", padding: "8px 12px 8px 8px" }}
              >
                <span style={{ fontSize: 17, lineHeight: 1 }}>🇮🇳</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.ink }}>India</span>
                <ChevronDown size={13} style={{ color: C.inkFaint }} />
              </div>
            </div>

            <div className="relative" style={{ height: "clamp(230px, 62vw, 300px)", marginTop: 4 }}>
              <svg
                viewBox={`0 0 ${INDIA_HERO_VB.w} ${INDIA_HERO_VB.h}`}
                className="absolute inset-0"
                style={{ width: "100%", height: "100%" }}
              >
                <defs>
                  <linearGradient id="indiaFill" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#7C3AED" />
                    <stop offset="100%" stopColor="#3B82F6" />
                  </linearGradient>
                  <filter id="heroGlow" x="-80%" y="-80%" width="260%" height="260%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  {/* Kept in the path's own original coordinates — nested
                      inside the same translated <g> as the landmass below,
                      so it composes in that already-shifted local space
                      rather than needing its own offset. */}
                  <clipPath id="indiaClip">
                    <path d={INDIA_HERO_PATH} />
                  </clipPath>
                  {HERO_CONNECTIONS.map((conn) => (
                    <linearGradient key={conn.id} id={conn.id} x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor={conn.from} stopOpacity="0.9" />
                      <stop offset="100%" stopColor={conn.to} stopOpacity="0.18" />
                    </linearGradient>
                  ))}
                </defs>

                {/* Curved multicolor connection lines fanning from nodes
                    across the landmass out to a full ring of glowing dots
                    around the panel's edge */}
                {HERO_CONNECTIONS.map((conn) => (
                  <path
                    key={conn.id}
                    d={conn.d}
                    fill="none"
                    stroke={`url(#${conn.id})`}
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    filter="url(#heroGlow)"
                    opacity="0.8"
                  />
                ))}

                {/* India landmass + its decorative texture, all in one
                    group shifted into the wide canvas's center */}
                <g transform={`translate(${INDIA_HERO_OFFSET_X}, ${INDIA_HERO_OFFSET_Y})`}>
                  <path d={INDIA_HERO_PATH} fill="url(#indiaFill)" stroke="rgba(255,255,255,0.55)" strokeWidth="1.2" />

                  {/* Stylized internal boundary lines, clipped to the landmass —
                      decorative only, not literal state borders */}
                  <g clipPath="url(#indiaClip)" opacity="0.3" stroke="#fff" strokeWidth="0.8" fill="none">
                    <path d="M60,50 C75,90 85,140 75,200" />
                    <path d="M100,15 C105,60 110,120 95,190" />
                    <path d="M35,110 C65,115 105,120 155,105" />
                    <path d="M50,175 C75,165 100,160 135,150" />
                  </g>

                  {/* Dense scatter of small glowing dots across the
                      landmass — the "city lights at night" texture from
                      the reference image. */}
                  <g clipPath="url(#indiaClip)">
                    {HERO_STARFIELD.map((d, i) => (
                      <circle key={i} cx={d.x} cy={d.y} r={d.size} fill="#fff" opacity={d.opacity} />
                    ))}
                  </g>

                  {/* Sri Lanka, for scale/orientation */}
                  <circle cx={INDIA_HERO_SRI_LANKA.x} cy={INDIA_HERO_SRI_LANKA.y} r="4" fill="url(#indiaFill)" opacity="0.85" />
                </g>

                {/* Glowing connection nodes over the map */}
                {HERO_NODES.map((n) => (
                  <g key={n.id}>
                    <circle cx={n.x} cy={n.y} r="9" fill={n.color} opacity="0.18" />
                    <circle cx={n.x} cy={n.y} r="4.5" fill={n.color} filter="url(#heroGlow)" />
                    <circle cx={n.x} cy={n.y} r="2" fill="#fff" />
                  </g>
                ))}

                {/* Ring of glowing endpoint dots around the panel's edge */}
                {HERO_OUTER_NODES.map((n) => (
                  <g key={n.id}>
                    <circle cx={n.x} cy={n.y} r="6" fill={n.color} opacity="0.22" />
                    <circle cx={n.x} cy={n.y} r="3" fill={n.color} filter="url(#heroGlow)" />
                    <circle cx={n.x} cy={n.y} r="1.3" fill="#fff" />
                  </g>
                ))}
              </svg>

              {/* Stat chips — bottom-left, clear of the map's center */}
              <div className="absolute flex flex-col gap-2.5" style={{ left: "5%", bottom: "6%" }}>
                <div
                  className="flex items-center gap-2.5 rounded-2xl"
                  style={{ background: C.surface, border: `1px solid ${C.line}`, boxShadow: "0 6px 16px rgba(76,29,149,0.10)", padding: "9px 14px" }}
                >
                  <span className="flex items-center justify-center flex-shrink-0 rounded-full" style={{ width: 30, height: 30, background: C.accentSoft }}>
                    <Users2 size={15} style={{ color: C.accent }} />
                  </span>
                  <div className="min-w-0">
                    <div style={{ fontSize: 9.5, color: C.inkSoft, lineHeight: 1.1 }}>Active Users</div>
                    <div className="mono font-bold" style={{ fontSize: 15, color: C.accent, lineHeight: 1.25 }}>{fmtUsers(totalLiveUsers)}</div>
                  </div>
                </div>
                <div
                  className="flex items-center gap-2.5 rounded-2xl"
                  style={{ background: C.surface, border: `1px solid ${C.line}`, boxShadow: "0 6px 16px rgba(76,29,149,0.10)", padding: "9px 14px" }}
                >
                  <span className="flex items-center justify-center flex-shrink-0 rounded-full" style={{ width: 30, height: 30, background: C.accentSoft }}>
                    <Globe2 size={15} style={{ color: C.accent }} />
                  </span>
                  <div className="min-w-0">
                    <div style={{ fontSize: 9.5, color: C.inkSoft, lineHeight: 1.1 }}>Countries</div>
                    <div className="mono font-bold" style={{ fontSize: 15, color: C.accent, lineHeight: 1.25 }}>{COVERAGE_ALL_COUNTRIES.length}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Flag strip: flags only — tap centers & zooms the map to that country */}
        <div className="mt-4">
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
                    aria-label={
                      c.active
                        ? `${c.name}, ${fmtUsers(data[c.code]?.users ?? 0)} active users (demo figure)`
                        : c.name
                    }
                    className="snap-center flex-shrink-0"
                  >
                    <div
                      className="relative rounded-xl overflow-hidden"
                      style={{ width: 64, height: 40, border: isSel ? `2px solid ${C.accent}` : `1px solid ${C.line}`, boxShadow: isSel ? '0 6px 16px rgba(124,58,237,0.22)' : 'none', opacity: c.active ? 1 : 0.4 }}
                    >
                      <CoverageFlag code={c.code} width={64} height={40} />
                    </div>
                    {/* Fallback/demo figure — see useCoverageStats in
                        api/coverage.ts; no backend country-wise
                        active-user endpoint exists yet. 12px is the
                        react-doctor no-tiny-text floor for body text. */}
                    <div
                      style={{
                        marginTop: 3,
                        textAlign: "center",
                        fontSize: 12,
                        fontWeight: 700,
                        letterSpacing: 0.1,
                        whiteSpace: "nowrap",
                        color: isSel ? C.accent : C.inkFaint,
                      }}
                    >
                      {c.active ? fmtUsers(data[c.code]?.users ?? 0) : "—"}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mt-4 px-5">
          <div className="rounded-2xl" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
            {isActive ? (
              <>
                <div className="flex items-center justify-between px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: C.accentSoft }}>
                      <Activity size={17} style={{ color: C.accent }} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: C.ink }}>Total Transaction Volume</div>
                      <div className="text-xs" style={{ color: C.inkSoft }}>Last 1 minute</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="mono font-bold text-lg" style={{ color: C.accent }}>{fmtVolume(cd!.volume)}</div>
                    <div className="flex items-center justify-end gap-1 mt-0.5 px-2 py-0.5 rounded-full" style={{ background: volPct >= 0 ? C.positiveSoft : C.negativeSoft }}>
                      {volPct >= 0 ? <ArrowUp size={10} style={{ color: C.positive }} /> : <ArrowDown size={10} style={{ color: C.negative }} />}
                      <span className="text-[11px] mono" style={{ color: volPct >= 0 ? C.positive : C.negative }}>{Math.abs(volPct).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                <div style={{ borderTop: `1px solid ${C.line}` }} />
                <div className="flex items-center justify-between px-4 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: C.positiveSoft }}>
                      <Zap size={17} style={{ color: C.positive }} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: C.ink }}>Transactions Per Second</div>
                      <div className="text-xs" style={{ color: C.inkSoft }}>Real-time</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="mono font-bold text-lg" style={{ color: C.positive }}>{cd!.tps.toLocaleString()}</div>
                    <div className="flex items-center justify-end gap-1 mt-0.5 px-2 py-0.5 rounded-full" style={{ background: tpsPct >= 0 ? C.positiveSoft : C.negativeSoft }}>
                      {tpsPct >= 0 ? <ArrowUp size={10} style={{ color: C.positive }} /> : <ArrowDown size={10} style={{ color: C.negative }} />}
                      <span className="text-[11px] mono" style={{ color: tpsPct >= 0 ? C.positive : C.negative }}>{Math.abs(tpsPct).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
                <div style={{ borderTop: `1px solid ${C.line}` }} />
                <div className="flex items-center justify-between px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <History size={12} style={{ color: C.inkFaint }} />
                    <span className="text-[11px]" style={{ color: C.inkFaint }}>Updated {fmtTime(lastUpdated)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RefreshCw size={12} style={{ color: C.inkFaint }} />
                    <span className="text-[11px]" style={{ color: C.inkFaint }}>Refreshes every 2.5s</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3 px-4 py-5">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: C.negativeSoft }}>
                  <Activity size={17} style={{ color: C.negative }} />
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: C.ink }}>No live activity yet</div>
                  <div className="text-xs" style={{ color: C.inkSoft }}>{country.name} isn't integrated for transfers yet</div>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
