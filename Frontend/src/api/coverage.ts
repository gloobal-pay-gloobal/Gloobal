export interface CoverageStat {
  code: string;
  volume: number;
  tps: number;
  users: number;
}

// The real Gloobal backend has no coverage/analytics endpoint yet — this
// stays disabled rather than calling a fake `/coverage/stats` route.
// GlobalCoverageScreen keeps seeding its live-ticking display (including
// the per-country "active users" figure shown under each flag) from its
// own static COVERAGE_COUNTRIES_RAW baseline, exactly as when this is
// disabled. Those per-country user counts are DEMO/FALLBACK data, not
// real backend counts.
//
// TODO(backend): to make per-country active-user counts real, the User
// model needs a dedicated country/countryIso field set at registration
// (mobileNumber's dial-code prefix is not a reliable substitute — it's
// re-normalized by normalizeMobileNumber() in server.js, which force-maps
// any bare 10-digit number to +91 regardless of the country actually
// picked, so it can't be trusted for country grouping). Once that field
// exists, a simple `User.aggregate([{ $group: { _id: '$countryIso',
// count: { $sum: 1 } } }])`-style endpoint could back this for real.
export function useCoverageStats(): { enabled: boolean; stats: CoverageStat[] | undefined; isLoading: boolean } {
  return { enabled: false, stats: undefined, isLoading: false };
}
