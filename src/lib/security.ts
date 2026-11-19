import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

export type CompanyRole = "owner" | "admin" | "member";
export const teamsEnabled = import.meta.env["VITE_NEXUS_TEAMS_ENABLED"] === "true";
type Member = { company_id: string; user_id: string; role: CompanyRole; created_at: string };
type SecurityDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: Database["public"]["Tables"] & {
      company_members: { Row: Member; Insert: never; Update: never; Relationships: [] };
    };
    Functions: Database["public"]["Functions"] & {
      create_company_invitation: {
        Args: { _company: string; _email: string; _role: string };
        Returns: string;
      };
      accept_company_invitation: { Args: { _token: string }; Returns: string };
      set_company_member_role: {
        Args: { _company: string; _user: string; _role: string };
        Returns: undefined;
      };
      remove_company_member: { Args: { _company: string; _user: string }; Returns: undefined };
      revoke_company_invitation: { Args: { _token: string }; Returns: undefined };
    };
  };
};
// Separate contract until Lovable regenerates its managed client types.
export const securityClient = supabase as unknown as SupabaseClient<SecurityDatabase>;
export const canManage = (role?: CompanyRole) => role === "owner" || role === "admin";
export function requireManagedRole(role?: CompanyRole) {
  if (!canManage(role)) throw new Error("Permissão de administrador necessária");
}
