import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Operation, Rule } from "./nexus";

export const companiesQuery = queryOptions({
  queryKey: ["companies"],
  queryFn: async () => {
    const { data, error } = await supabase.from("companies").select("*").order("created_at");
    if (error) throw error;
    return data;
  },
});

export const opsQuery = (companyId: string) =>
  queryOptions({
    queryKey: ["ops", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("operations").select("*").eq("company_id", companyId).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Operation[];
    },
  });

export const rulesQuery = (companyId: string) =>
  queryOptions({
    queryKey: ["rules", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("rules").select("*").eq("company_id", companyId).order("created_at");
      if (error) throw error;
      return data as Rule[];
    },
  });
