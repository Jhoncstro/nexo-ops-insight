import { createContext, useContext } from "react";

import type { CompanyRole } from "./security";

export interface Company {
  id: string;
  role?: CompanyRole | undefined;
  name: string;
  sector: string | null;
  location: string | null;
}
export const CompanyContext = createContext<Company | null>(null);
export function useCompany(): Company {
  const c = useContext(CompanyContext);
  if (!c) throw new Error("Nenhuma empresa ativa");
  return c;
}
