import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Session tokens and balances are money data — refetch on window
      // focus/reconnect rather than trusting a stale cached value, and
      // don't retry forever on a broken network (fail fast, let the UI
      // show a real error instead of spinning).
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
      staleTime: 0,
    },
  },
});
