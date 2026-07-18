import { ALL_COUNTRIES, COUNTRY_BY_ISO } from "./countries";

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
// Gloobal Coverage's search/browse list is now just the shared ALL_COUNTRIES
// dataset (same list, same order, same flags, same search predicate as the
// Registration country picker) with two extra facts merged in per country:
// whether it's live, and — only if live — its coverage stats/coordinates.
// This is the one and only country list Gloobal Coverage uses.
export const COVERAGE_ALL_COUNTRIES = ALL_COUNTRIES.map((c) => {
  const code = c.iso;
  const live = ACTIVE_ISO_SET.has(code);
  return { ...c, code, active: live, coverage: live ? COVERAGE_BY_ISO[code] : null };
});
export function fmtVolume(v) { return `$${v.toFixed(2)}M+`; }
export function fmtUsers(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}
export function fmtTime(d) { return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }

// Remembers which country the person last picked on this screen, so it
// reopens centered on that choice instead of always resetting — including
// across a full app restart, not just while the screen stays mounted.
// Wrapped in try/catch since localStorage can throw in some contexts
// (private browsing, disabled storage) — falling back to in-memory-only
// behavior rather than crashing the screen.
const COVERAGE_COUNTRY_STORAGE_KEY = "gloobalId.coverage.lastCountry";
let inMemoryCoverageCountry = null;

export function loadStoredCoverageCountry() {
  try {
    const stored = window.localStorage.getItem(COVERAGE_COUNTRY_STORAGE_KEY);
    if (stored) return stored;
  } catch {
    // ignore — fall through to the in-memory value
  }
  return inMemoryCoverageCountry;
}

export function saveStoredCoverageCountry(code) {
  inMemoryCoverageCountry = code;
  try {
    window.localStorage.setItem(COVERAGE_COUNTRY_STORAGE_KEY, code);
  } catch {
    // storage unavailable — the in-memory value above still covers the
    // current session
  }
}
