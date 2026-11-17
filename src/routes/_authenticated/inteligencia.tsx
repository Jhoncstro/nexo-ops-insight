import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Eye } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCompany } from "@/lib/company";
import { opsQuery, rulesQuery } from "@/lib/data";
import { computeMetrics, evaluateRules, STATUS_LABEL, toCsv, type Status } from "@/lib/nexus";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/inteligencia")({
  head: () => ({ meta: [{ title: "Inteligência operacional — Nexus Workspace" }, { name: "description", content: "Gráficos, sinais e relatórios da operação." }, { property: "og:title", content: "Inteligência operacional — Nexus Workspace" }, { property: "og:description", content: "Gráficos, sinais e relatórios da operação." }] }),
  component: Inteligencia,
});

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

function Inteligencia() {
  const company = useCompany();
  const { data: ops = [] } = useQuery(opsQuery(company.id));
  const { data: rules = [] } = useQuery(rulesQuery(company.id));
  const m = computeMetrics(ops);

  const months: { key: string; mes: string; Abertas: number; Concluídas: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: d.toISOString().slice(0, 7), mes: d.toLocaleDateString("pt-BR", { month: "short" }), Abertas: 0, Concluídas: 0 });
  }
  for (const o of ops) {
    const a = months.find((x) => x.key === o.created_at.slice(0, 7)); if (a) a.Abertas++;
    const c = o.completed_at && months.find((x) => x.key === o.completed_at!.slice(0, 7)); if (c) c.Concluídas++;
  }
  const cats = Object.entries(ops.reduce<Record<string, number>>((acc, o) => ({ ...acc, [o.category]: (acc[o.category] ?? 0) + 1 }), {}))
    .map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const statusData = (["aberta", "andamento", "concluida"] as Status[]).map((s) => ({ name: STATUS_LABEL[s], value: ops.filter((o) => o.status === s).length })).filter((x) => x.value > 0);

  const signals = [
    ...evaluateRules(rules, m).map((r) => ({ t: r.rule.name, d: `${r.explanation} ${r.rule.guidance ?? ""}` })),
    ...(m.total ? [{ t: `Ritmo de entrega em ${m.ritmo}%`, d: `${m.concluidas} de ${m.total} operações concluídas.` }] : []),
    ...(cats[0] ? [{ t: `Maior volume: ${cats[0].name}`, d: `${cats[0].value} operações (${Math.round((cats[0].value / m.total) * 100)}% do total).` }] : []),
    ...(m.atrasadas ? [{ t: `${m.atrasadas} operação(ões) fora do prazo`, d: "Revise prazos e responsáveis dessas operações." }] : []),
  ];

  function exportCsv() {
    const blob = new Blob(["\ufeff" + toCsv(ops)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio-${company.name.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-semibold">Inteligência operacional</h1><p className="text-muted-foreground">Tendências e sinais para revisão humana.</p></div>
        <Button variant="outline" onClick={exportCsv} disabled={!ops.length}><Download /> Exportar CSV</Button>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-lg">Fluxo mensal</CardTitle></CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer><BarChart data={months}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="mes" /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Bar dataKey="Abertas" fill="var(--chart-4)" radius={[4, 4, 0, 0]} /><Bar dataKey="Concluídas" fill="var(--chart-1)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-lg">Volume por categoria</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer><BarChart data={cats} layout="vertical"><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={100} /><Tooltip /><Bar dataKey="value" name="Operações" fill="var(--chart-2)" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">Composição por status</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} label={({ percent }) => `${Math.round(percent * 100)}%`}>{statusData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Pie><Tooltip /><Legend /></PieChart></ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Eye className="h-5 w-5 text-gold" />Sinais e insights</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {signals.length === 0 && <p className="text-sm text-muted-foreground">Sem sinais por enquanto — registre operações para gerar insights.</p>}
          {signals.map((s, i) => (
            <div key={i} className="rounded-md border bg-muted/50 p-3"><p className="font-medium">{s.t}</p><p className="text-sm text-muted-foreground">{s.d}</p></div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
