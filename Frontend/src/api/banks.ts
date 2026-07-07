import { BANKS_BY_COUNTRY } from "../data/banks";
import type { Bank } from "../types";

// The real Gloobal backend has no bank-directory endpoint (see CLAUDE.md's
// endpoint table) — this always serves the static demo table rather than
// calling a fake `/banks` route. AddBankScreen already treats bank
// linking as a local prototype (saved to localStorage, not the backend),
// so this matches the rest of that flow.
export function useBanks(countryIso: string): { banks: Bank[]; isLoading: boolean; isError: boolean } {
  return { banks: BANKS_BY_COUNTRY[countryIso] || [], isLoading: false, isError: false };
}
