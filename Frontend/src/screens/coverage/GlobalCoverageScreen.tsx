import React, { useState, useEffect, useRef, useMemo } from "react";
import { useCoverageStats } from "../../api/coverage";
import { Flag } from "../../components/common/Flag";
import { FlagEmoji } from "../../components/icons/MiscIcons";
import { ALL_COUNTRIES, COUNTRY_BY_ISO, countryMatches, isoToFlag } from "../../data/countries";
import { Activity, ArrowDown, ArrowUp, Bell, ChevronLeft, Globe2, History, Home, RefreshCw, ScanLine, Search, User, Users2, X, Zap } from "lucide-react";
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

export const LANDMASSES = [
  { cx: -155, cy: 64, rx: 14, ry: 9 }, { cx: -105, cy: 46, rx: 28, ry: 17 }, { cx: -80, cy: 55, rx: 14, ry: 14 },
  { cx: -42, cy: 73, rx: 11, ry: 9 }, { cx: -92, cy: 18, rx: 8, ry: 6 }, { cx: -60, cy: -8, rx: 16, ry: 20 },
  { cx: -65, cy: -32, rx: 11, ry: 14 }, { cx: -6, cy: 53, rx: 8, ry: 6 }, { cx: 14, cy: 49, rx: 17, ry: 11 },
  { cx: 38, cy: 62, rx: 12, ry: 9 }, { cx: 18, cy: 4, rx: 20, ry: 16 }, { cx: 25, cy: -20, rx: 15, ry: 16 },
  { cx: 45, cy: 26, rx: 12, ry: 10 }, { cx: 90, cy: 58, rx: 42, ry: 17 }, { cx: 78, cy: 22, rx: 12, ry: 12 },
  { cx: 108, cy: 12, rx: 11, ry: 9 }, { cx: 117, cy: 35, rx: 16, ry: 13 }, { cx: 136, cy: -25, rx: 15, ry: 10 },
];

export function lonLatToXY(lng: number, lat: number, w: number, h: number): [number, number] { return [((lng + 180) / 360) * w, ((90 - lat) / 180) * h]; }
export function isLand(lng: number, lat: number) {
  return LANDMASSES.some((e) => { const dx = (lng - e.cx) / e.rx, dy = (lat - e.cy) / e.ry; return dx * dx + dy * dy <= 1; });
}
export const MAP_W = 600, MAP_H = 280;
export function buildDots() {
  const cols = 62, rows = 28, out: { x: number; y: number; key: string }[] = [];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const lng = -180 + (i + 0.5) * (360 / cols), lat = 88 - (j + 0.9) * (176 / rows);
    if (isLand(lng, lat)) { const [x, y] = lonLatToXY(lng, lat, MAP_W, MAP_H); out.push({ x, y, key: `${i}-${j}` }); }
  }
  return out;
}
export function fmtVolume(v: number) { return `$${v.toFixed(2)}M+`; }
export function fmtUsers(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}
export function fmtTime(d: Date) { return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }

// Builds the CSS transform that re-centers the map on (cx, cy) at the given
// zoom, keeping the point fixed at the viewport's center after scaling —
// this is what lets tapping a flag "fit the whole country" instead of a
// fixed, tight zoom.
export function mapFocusTransform(cx: number, cy: number, zoom: number) {
  return `translate(${MAP_W / 2}px, ${MAP_H / 2}px) scale(${zoom}) translate(${-cx}px, ${-cy}px)`;
}

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

export function clampZoom(z: number) {
  return Math.min(3, Math.max(0.6, z));
}

// A small, curated set of major financial-hub countries the selected
// country's banking network connects out to. Kept short on purpose (the
// design calls for 6–12 connections) so the map reads as a deliberate,
// balanced network rather than a dense web — never all 22 countries.
export const HUB_PRIORITY = ['US', 'GB', 'CN', 'JP', 'DE', 'CH', 'AE', 'FR', 'SA', 'KR'];

// A gentle outward arc between two map points, instead of a straight
// line — reads as a "flight path" style banking connection.
export function curvedConnectionPath([x1, y1]: [number, number], [x2, y2]: [number, number]) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const offset = Math.min(dist * 0.22, 46);
  const nx = -dy / dist;
  const ny = dx / dist;
  const cx = mx + nx * offset;
  const cy = my + ny * offset;
  return `M ${x1},${y1} Q ${cx},${cy} ${x2},${y2}`;
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
  const [activeTab, setActiveTab] = useState('Home');
  const [toast, setToast] = useState<string | null>(null);
  const [countryQuery, setCountryQuery] = useState('');
  // Manual pinch/wheel zoom, layered on top of the automatic "fit the
  // country" zoom below — resets whenever the selected country changes.
  const [userZoom, setUserZoom] = useState(1);
  const cardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const pinchDistRef = useRef<number | null>(null);
  const dots = useMemo(buildDots, []);
  const ambientFlags = useAmbientFlags();

  useEffect(() => {
    setUserZoom(1);
  }, [selected]);

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
  const marker = useMemo(
    () => (isActive && country.coverage ? lonLatToXY(country.coverage.lng, country.coverage.lat, MAP_W, MAP_H) : null),
    [country, isActive]
  );
  const mapZoom = isActive && country.coverage?.zoom ? country.coverage.zoom : 1;
  const mapTransform = marker
    ? mapFocusTransform(marker[0], marker[1], clampZoom(mapZoom * userZoom))
    : mapFocusTransform(MAP_W / 2, MAP_H / 2, clampZoom(userZoom));
  const totalLiveUsers = useMemo(
    () => COVERAGE_COUNTRIES.reduce((sum, c) => sum + (data[c.code]?.users || 0), 0),
    [data]
  );

  // The selected country's small, curated banking network — a handful of
  // major financial hubs it "connects" to. Recomputed (and re-animated,
  // since each connection remounts with a fresh key) every time the hub
  // changes.
  const networkTargets = useMemo(() => {
    if (!marker) return [];
    return HUB_PRIORITY
      .filter((code) => code !== selected && COVERAGE_BY_ISO[code])
      .slice(0, 8)
      .map((code) => COVERAGE_BY_ISO[code]);
  }, [selected, marker]);

  function selectCountry(code: string) {
    setSelected(code);
    saveStoredCoverageCountry(code);
    cardRefs.current[code]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
  function handleTab(tab: string) {
    setActiveTab(tab);
    if (tab !== 'Home') { setToast(`${tab} is on the way`); setTimeout(() => setToast(null), 1800); }
  }

  // Desktop wheel-zoom and mobile pinch-to-zoom on the map, layered on top
  // of the automatic per-country fit zoom via userZoom.
  function handleMapWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    setUserZoom((z) => clampZoom(z * (e.deltaY < 0 ? 1.08 : 0.93)));
  }
  function touchDistance(touches: React.TouchList) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function handleMapTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length === 2) pinchDistRef.current = touchDistance(e.touches);
  }
  function handleMapTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length === 2 && pinchDistRef.current) {
      const d = touchDistance(e.touches);
      setUserZoom((z) => clampZoom(z * (d / pinchDistRef.current!)));
      pinchDistRef.current = d;
    }
  }
  function handleMapTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length < 2) pinchDistRef.current = null;
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
          <div
            className="flex-1 flex items-center gap-2 rounded-2xl px-4 py-2.5"
            style={{ background: C.surface, border: `1px solid ${C.line}` }}
          >
            <Globe2 size={16} style={{ color: C.accent, flexShrink: 0 }} />
            <input
              value={countryQuery}
              onChange={(e) => setCountryQuery(e.target.value)}
              placeholder="Global Coverage, Country..."
              aria-label="Search Global Coverage by country"
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
          <button aria-label="Notifications" className="relative w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
            <Bell size={17} style={{ color: C.ink }} />
            <span className="absolute top-2 right-2.5 w-1.5 h-1.5 rounded-full" style={{ background: C.negative }} />
          </button>
        </div>

        {/* Map — now the primary focus of the screen */}
        <div className="mt-1 px-5">
          <div
            className="relative rounded-2xl overflow-hidden"
            style={{ background: C.mapBg, touchAction: "none" }}
            onWheel={handleMapWheel}
            onTouchStart={handleMapTouchStart}
            onTouchMove={handleMapTouchMove}
            onTouchEnd={handleMapTouchEnd}
          >
            {/* Soft atmosphere glow behind the map content, for depth */}
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "radial-gradient(60% 60% at 50% 40%, rgba(124,58,237,0.16) 0%, rgba(124,58,237,0) 70%)",
              }}
            />
            <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="relative w-full h-auto block" style={{ display: "block" }}>
              <defs>
                <linearGradient id="covConnGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.3" />
                </linearGradient>
                <filter id="covGlow" x="-60%" y="-60%" width="220%" height="220%">
                  <feGaussianBlur stdDeviation="2.4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <g style={{ transform: mapTransform, transformOrigin: "0px 0px", transition: "transform 0.85s cubic-bezier(0.22, 1, 0.36, 1)" }}>
                {/* Muted-gray landmasses — a clean, quiet base for the network to stand out against */}
                {dots.map((d) => <circle key={d.key} cx={d.x} cy={d.y} r={1.5} fill={C.mapLand} />)}

                {/* Banking network: a small, curated set of glowing connections
                    fanning out from the selected country (the hub) — no more a
                    dense scatter of every country's marker. */}
                {marker && networkTargets.map((t, i) => {
                  const target = lonLatToXY(t.lng, t.lat, MAP_W, MAP_H);
                  const pathD = curvedConnectionPath(marker, target);
                  const pathId = `cov-conn-${t.code}`;
                  const dur = (3.4 + (i % 4) * 0.5).toFixed(1);
                  return (
                    <g key={t.code}>
                      <path
                        id={pathId}
                        d={pathD}
                        fill="none"
                        stroke="url(#covConnGradient)"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        filter="url(#covGlow)"
                        opacity="0.8"
                      />
                      <circle r="2.2" fill="#C4B5FD" filter="url(#covGlow)">
                        <animateMotion dur={`${dur}s`} repeatCount="indefinite">
                          <mpath href={`#${pathId}`} />
                        </animateMotion>
                      </circle>
                      <g onClick={() => selectCountry(t.code)} style={{ cursor: "pointer" }}>
                        <circle cx={target[0]} cy={target[1]} r={9} fill="transparent" />
                        <circle cx={target[0]} cy={target[1]} r={6.5} fill="none" stroke="#8B5CF6" strokeOpacity="0.4" strokeWidth="1.4" />
                        <circle cx={target[0]} cy={target[1]} r={3.4} fill="#8B5CF6" filter="url(#covGlow)" />
                      </g>
                    </g>
                  );
                })}

                {/* The hub itself — the selected country, glowing in the app's accent color */}
                {marker && (
                  <>
                    <circle cx={marker[0]} cy={marker[1]} r={14} fill="url(#covConnGradient)" opacity="0.18" />
                    <circle className="pulse-ring" cx={marker[0]} cy={marker[1]} r={7} fill="none" stroke="#8B5CF6" strokeWidth="2" style={{ animation: 'pulseRing 2.2s ease-out infinite', transformOrigin: `${marker[0]}px ${marker[1]}px` }} />
                    <circle cx={marker[0]} cy={marker[1]} r={5.5} fill="#C4B5FD" filter="url(#covGlow)" />
                  </>
                )}
              </g>
            </svg>

            {/* Floating glass overlay: icons + numbers only */}
            <div
              className="absolute top-3 right-3 flex flex-col gap-2 rounded-2xl px-3 py-2.5"
              style={{
                background: "rgba(255,255,255,0.14)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.25)",
                boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
              }}
            >
              <div className="flex items-center gap-1.5">
                <Users2 size={13} style={{ color: "#fff" }} />
                <span className="mono text-[12px] font-semibold" style={{ color: "#fff" }}>{fmtUsers(totalLiveUsers)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Globe2 size={13} style={{ color: "#fff" }} />
                <span className="mono text-[12px] font-semibold" style={{ color: "#fff" }}>{COVERAGE_ALL_COUNTRIES.length}</span>
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

        {/* Toast */}
        {toast && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-medium" style={{ background: C.ink, color: '#fff' }}>
            {toast}
          </div>
        )}

        {/* Bottom nav */}
        <div className="mt-4 px-4 pb-5 pt-2">
          <div className="flex items-center justify-between rounded-full px-2 py-2" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
            {[
              { key: 'Home', label: 'Home', Icon: Home },
              { key: 'Scan', label: 'Scan', Icon: ScanLine },
              { key: 'Profile', label: 'Profile', Icon: User },
              { key: 'History', label: 'History', Icon: History },
            ].map(({ key, label, Icon }) => {
              const isActive = activeTab === key;
              return (
                <button key={key} onClick={() => handleTab(key)} className="flex flex-col items-center gap-1 px-4 py-1.5 rounded-full flex-1">
                  <Icon size={18} style={{ color: isActive ? C.accent : C.inkFaint }} />
                  <span className="text-[10px] font-medium" style={{ color: isActive ? C.accent : C.inkFaint }}>{label}</span>
                  {isActive && <span className="w-4 h-0.5 rounded-full mt-0.5" style={{ background: C.accent }} />}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
