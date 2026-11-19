import type { QueryClient } from "@tanstack/react-query";
export const ACTIVE_COMPANY_KEY = "nexus-active-company";
export function clearSessionCache(client: QueryClient) {
  // Cancellation propagates to Supabase through each query's AbortSignal.
  void client.cancelQueries();
  client.clear();
  if (typeof window !== "undefined") localStorage.removeItem(ACTIVE_COMPANY_KEY);
}
