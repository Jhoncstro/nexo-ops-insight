import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, ListChecks, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Nexus Workspace — Gestão operacional para PMEs" },
      { name: "description", content: "Organize operações, acompanhe prazos e receba recomendações explicáveis para sua empresa." },
      { property: "og:title", content: "Nexus Workspace — Gestão operacional para PMEs" },
      { property: "og:description", content: "Operações, inteligência e regras internas em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const items = [
    { icon: ListChecks, t: "Operações", d: "Prazos, responsáveis e prioridades num só quadro." },
    { icon: BarChart3, t: "Inteligência", d: "Fluxo mensal, categorias e sinais para revisão." },
    { icon: ShieldCheck, t: "Regras internas", d: "Critérios de atenção definidos pela sua equipe." },
  ];
  return (
    <div className="min-h-screen bg-sidebar text-sidebar-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 font-display text-xl text-sidebar-accent-foreground">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-gold font-bold text-gold-foreground">N</span>
          Nexus Workspace
        </div>
        <Button asChild variant="ghost" className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
          <Link to="/auth">Entrar</Link>
        </Button>
      </header>
      <main className="mx-auto max-w-6xl px-6 pb-24 pt-16">
        <p className="text-sm uppercase tracking-[0.2em] text-gold">Nexo Empresarial</p>
        <h1 className="mt-4 max-w-3xl text-5xl font-semibold leading-tight text-sidebar-accent-foreground md:text-6xl">
          Gestão operacional com inteligência que você consegue explicar.
        </h1>
        <p className="mt-6 max-w-xl text-lg opacity-80">
          Acompanhe o que está em aberto, o que está atrasado e o que merece atenção — com recomendações baseadas nas regras da sua empresa.
        </p>
        <Button asChild size="lg" className="mt-10 bg-gold text-gold-foreground hover:bg-gold/90">
          <Link to="/auth">Começar agora <ArrowRight /></Link>
        </Button>
        <div className="mt-20 grid gap-6 md:grid-cols-3">
          {items.map((i) => (
            <div key={i.t} className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-6">
              <i.icon className="h-6 w-6 text-gold" />
              <h3 className="mt-4 text-lg text-sidebar-accent-foreground">{i.t}</h3>
              <p className="mt-2 text-sm opacity-75">{i.d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
