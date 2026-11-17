import { createContext, useContext } from "react";

export interface Company { id: string; name: string; sector: string | null; location: string | null }
export const CompanyContext = createContext<Company | null>(null);
export function useCompany(): Company {
  const c = useContext(CompanyContext);
  if (!c) throw new Error("Nenhuma empresa ativa");
  return c;
}
