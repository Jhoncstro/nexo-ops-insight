import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Clock, Flame, FolderOpen, Lightbulb } from "lucide-react";
import { useCompany } from "@/lib/company";
import { opsQuery, rulesQuery } from "@/lib/data";
import { computeMetrics, evaluateRules, isOverdue } from "@/lib/nexus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PriorityBadge, StatusBadge } from "@/components/badges";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Visão geral — Nexus Workspace" }, { name: "description", content: "Indicadores e recomendações da sua operação." }, { property: "og:title", content: "Visão geral — Nexus Workspace" }, { property: "og:description", content: "Indicadores e recomendações da sua operação." }] }),
  component: Dashboard,
});

function Dashboard() {
  const company = useCompany();
  const { data: ops = [] } = useQuery(opsQuery(company.id));
  const { data: rules = [] } = useQuery(rulesQuery(company.id));
  const m = computeMetrics(ops);
  const recs = evaluateRules(rules, m);
  const cards = [
    { l: "Operações em aberto", v: m.abertas, i: FolderOpen },
    { l: "Em andamento", v: m.andamento, i: Clock },
    { l: "Fora do prazo", v: m.atrasadas, i: AlertTriangle, warn: m.atrasadas > 0 },
    { l: "Prioridade alta", v: m.alta, i: Flame },
  ];
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div><h1 className="text-3xl font-semibold">Visão geral</h1><p className="text-muted-foreground">Panorama operacional de {company.name}.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.l}><CardContent className="flex items-center justify-between p-5">
            <div><p className="text-sm text-muted-foreground">{c.l}</p><p className="mt-1 font-display text-3xl">{c.v}</p></div>
            <c.i className={c.warn ? "h-6 w-6 text-destructive" : "h-6 w-6 text-primary"} />
          </CardContent></Card>
        ))}
      </div>
      <Card><CardContent className="p-5">
        <div className="mb-2 flex justify-between text-sm"><span className="font-medium">Ritmo de entrega</span><span className="text-muted-foreground">{m.ritmo}% concluído ({m.concluidas}/{m.total})</span></div>
        <Progress value={m.ritmo} />
      </CardContent></Card>
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader><CardTitle className="text-lg">Atividade recente</CardTitle></CardHeader>
          <CardContent className="divide-y">
            {ops.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma operação ainda. <Link to="/operacoes" className="text-primary underline">Crie a primeira</Link>.</p>}
            {ops.slice(0, 6).map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0"><p className="truncate font-medium">{o.title}</p><p className="text-xs text-muted-foreground">{o.owner_name || "Sem responsável"} · {o.category}{isOverdue(o) ? " · atrasada" : ""}</p></div>
                <div className="flex shrink-0 items-center gap-3"><PriorityBadge p={o.priority} /><StatusBadge s={o.status} /></div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Lightbulb className="h-5 w-5 text-gold" />Recomendações</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {rules.filter((r) => r.active).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma regra ativa. <Link to="/regras" className="text-primary underline">Configure regras internas</Link>.</p>}
            {rules.some((r) => r.active) && recs.length === 0 && <p className="text-sm text-muted-foreground">Nenhum critério de atenção foi acionado.</p>}
            {recs.map((r) => (
              <div key={r.rule.id} className="rounded-md border-l-4 border-gold bg-muted p-3">
                <p className="font-medium">{r.rule.name}</p>
                <p className="text-xs text-muted-foreground">Por quê: {r.explanation}</p>
                {r.rule.guidance && <p className="mt-1 text-sm">{r.rule.guidance}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
