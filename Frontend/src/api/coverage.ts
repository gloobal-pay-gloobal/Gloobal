export interface CoverageStat {
  code: string;
  volume: number;
  tps: number;
  users: number;
}

// The real Gloobal backend has no coverage/analytics endpoint yet — this
// stays disabled rather than calling a fake `/coverage/stats` route.
// GlobalCoverageScreen keeps seeding its live-ticking display from its own
// static COVERAGE_COUNTRIES_RAW baseline, exactly as when this is disabled.
export function useCoverageStats(): { enabled: boolean; stats: CoverageStat[] | undefined; isLoading: boolean } {
  return { enabled: false, stats: undefined, isLoading: false };
}
