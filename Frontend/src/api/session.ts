import { useQuery } from "@tanstack/react-query";
import { MOCK_generateSessionToken, QR_TTL_SECONDS } from "../lib/qr";
import type { SessionToken } from "../types";

export type { SessionToken };

// The real Gloobal backend has no QR/session-token-minting endpoint (see
// CLAUDE.md's endpoint table) — this stays a pure client-side prototype
// token, never a network call, so there's no fake backend route in play
// here. If a real `/api/qr/generate`-style endpoint ships later, swap the
// queryFn below for that call; nothing else in this file or ReceiveScreen
// needs to change.
export function useSessionToken(globalId: string, enabled: boolean) {
  return useQuery<SessionToken>({
    queryKey: ["sessionToken", globalId],
    queryFn: () => MOCK_generateSessionToken(globalId),
    enabled,
    // Mint a fresh token slightly before the current one expires, so the
    // displayed QR never has a visible dead window with no valid code.
    refetchInterval: (QR_TTL_SECONDS - 5) * 1000,
    staleTime: (QR_TTL_SECONDS - 5) * 1000,
  });
}
