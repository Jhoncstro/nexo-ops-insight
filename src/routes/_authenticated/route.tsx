import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { companiesQuery } from "@/lib/data";
import { ACTIVE_COMPANY_KEY } from "@/lib/session-cache";
import { TeamPanel } from "@/components/team-panel";
import { teamsEnabled } from "@/lib/security";
import { CompanyContext } from "@/lib/company";
import { AppSidebar } from "@/components/app-sidebar";
import { NewCompanyForm } from "@/components/new-company-form";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { userId: data.user.id };
  },
  component: Layout,
});

const KEY = ACTIVE_COMPANY_KEY;

function Layout() {
  const qc = useQueryClient();
  const { userId } = Route.useRouteContext();
  const { data: companies, isLoading, error, refetch } = useQuery(companiesQuery(userId));
  const [activeId, setActiveId] = useState<string | null>(null);
  useEffect(() => {
    setActiveId(localStorage.getItem(KEY));
  }, []);
  const select = (id: string) => {
    void qc.cancelQueries({ predicate: (q) => q.queryKey[0] !== "companies" });
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "companies" });
    localStorage.setItem(KEY, id);
    setActiveId(id);
  };

  if (error)
    return (
      <div role="alert" className="p-8">
        Não foi possível carregar suas empresas.{" "}
        <button onClick={() => void refetch()}>Tentar novamente</button>
      </div>
    );
  if (isLoading || !companies)
    return (
      <div className="grid min-h-screen place-items-center text-muted-foreground">Carregando…</div>
    );
  if (companies.length === 0)
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6">
        <div className="w-full max-w-md rounded-lg border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-semibold">Cadastre sua primeira empresa</h1>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">
            Cada empresa tem seu próprio workspace de operações e regras.
          </p>
          <NewCompanyForm onCreated={select} />
          {teamsEnabled && <TeamPanel onAccepted={select} />}
        </div>
      </div>
    );
  const active = companies.find((c) => c.id === activeId) ?? companies[0]!;

  return (
    <CompanyContext.Provider key={`${userId}:${active.id}`} value={active}>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar companies={companies} active={active} onSelect={select} />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="flex h-14 items-center gap-3 border-b bg-card px-4">
              <SidebarTrigger />
              <span className="text-sm text-muted-foreground">
                {active.name}
                {active.location ? ` · ${active.location}` : ""}
              </span>
            </header>
            <main className="flex-1 p-4 md:p-8">
              {teamsEnabled && <TeamPanel company={active} onAccepted={select} />}
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </CompanyContext.Provider>
  );
}
