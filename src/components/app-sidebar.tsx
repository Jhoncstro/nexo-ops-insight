import { useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { BarChart3, Building2, ChevronsUpDown, LayoutDashboard, ListChecks, LogOut, Plus, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Company } from "@/lib/company";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NewCompanyForm } from "./new-company-form";

const items = [
  { title: "Visão geral", url: "/dashboard", icon: LayoutDashboard },
  { title: "Operações", url: "/operacoes", icon: ListChecks },
  { title: "Inteligência", url: "/inteligencia", icon: BarChart3 },
  { title: "Regras internas", url: "/regras", icon: ShieldCheck },
] as const;

export function AppSidebar({ companies, active, onSelect }: { companies: Company[]; active: Company; onSelect: (id: string) => void }) {
  const path = useRouterState({ select: (r) => r.location.pathname });
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-sidebar-primary font-bold text-sidebar-primary-foreground">
                {active.name.charAt(0).toUpperCase()}
              </span>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate font-medium text-sidebar-accent-foreground">{active.name}</span>
                <span className="truncate text-xs opacity-70">{active.sector || "Empresa"}</span>
              </div>
              <ChevronsUpDown className="ml-auto h-4 w-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-60" align="start">
            <DropdownMenuLabel>Empresas</DropdownMenuLabel>
            {companies.map((c) => (
              <DropdownMenuItem key={c.id} onClick={() => onSelect(c.id)}>
                <Building2 /> <span className="truncate">{c.name}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setOpen(true)}><Plus /> Nova empresa</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((i) => (
                <SidebarMenuItem key={i.url}>
                  <SidebarMenuButton asChild isActive={path === i.url} tooltip={i.title}>
                    <Link to={i.url}><i.icon /><span>{i.title}</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut} tooltip="Sair"><LogOut /><span>Sair</span></SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cadastrar nova empresa</DialogTitle></DialogHeader>
          <NewCompanyForm onCreated={(id) => { onSelect(id); setOpen(false); }} />
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
