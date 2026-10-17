import { QueryClient } from '@tanstack/react-query';

/**
 * Global TanStack Query Client for Catalyst OS.
 * Configured with 30s stale time to eliminate redundant network requests,
 * deduplicate identical queries, and cache responses efficiently.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds freshness window
      gcTime: 5 * 60 * 1000, // 5 minutes garbage collection time
      refetchOnWindowFocus: false, // Prevent jarring background refetches on tab toggle
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});
