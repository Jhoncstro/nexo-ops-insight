import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { securityClient, teamsEnabled } from "./security";
import type { Operation, Rule } from "./nexus";

export const companiesQuery = (userId: string) =>
  queryOptions({
    queryKey: ["companies", userId],
    queryFn: async ({ signal }) => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user || auth.user.id !== userId)
        throw authError ?? new Error("Sessão expirada");
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("created_at")
        .abortSignal(signal);
      if (error) throw error;
      if (!teamsEnabled)
        return data.map((c) => ({
          ...c,
          role: c.owner_id === userId ? ("owner" as const) : undefined,
        }));
      const { data: members, error: membersError } = await securityClient
        .from("company_members")
        .select("company_id,role")
        .eq("user_id", auth.user.id)
        .abortSignal(signal);
      if (membersError) throw membersError;
      return data.map((c) => ({ ...c, role: members.find((m) => m.company_id === c.id)?.role }));
    },
  });

// Read all pages so metrics never silently stop at the API's row limit.
async function companyRows(table: "operations" | "rules", companyId: string, signal: AbortSignal) {
  const rows = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .order("id")
      .range(offset, offset + pageSize - 1)
      .abortSignal(signal);
    if (error) throw error;
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}
export const opsQuery = (companyId: string) =>
  queryOptions({
    queryKey: ["ops", companyId],
    enabled: !!companyId,
    throwOnError: true,
    queryFn: async ({ signal }) =>
      (await companyRows("operations", companyId, signal)) as Operation[],
  });
export const rulesQuery = (companyId: string) =>
  queryOptions({
    queryKey: ["rules", companyId],
    enabled: !!companyId,
    throwOnError: true,
    queryFn: async ({ signal }) => (await companyRows("rules", companyId, signal)) as Rule[],
  });
