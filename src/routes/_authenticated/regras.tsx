import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { canManage, requireManagedRole } from "@/lib/security";
import { useCompany } from "@/lib/company";
import { opsQuery, rulesQuery } from "@/lib/data";
import {
  compare,
  computeMetrics,
  METRIC_LABEL,
  metricValue,
  OPERATOR_LABEL,
  type Metric,
  type Operator,
  type Rule,
} from "@/lib/nexus";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/regras")({
  head: () => ({
    meta: [
      { title: "Regras internas — Nexus Workspace" },
      { name: "description", content: "Configure critérios de atenção da operação." },
      { property: "og:title", content: "Regras internas — Nexus Workspace" },
      { property: "og:description", content: "Configure critérios de atenção da operação." },
    ],
  }),
  component: Regras,
});

type Form = {
  id?: string;
  name: string;
  metric: Metric;
  operator: Operator;
  threshold: number;
  guidance: string;
};
const blank: Form = { name: "", metric: "atrasadas", operator: ">", threshold: 0, guidance: "" };

function Regras() {
  const company = useCompany();
  const qc = useQueryClient();
  const { data: rules = [] } = useQuery(rulesQuery(company.id));
  const { data: ops = [] } = useQuery(opsQuery(company.id));
  const m = computeMetrics(ops);
  const [form, setForm] = useState<Form | null>(null);
  const key = rulesQuery(company.id).queryKey;
  const done = () => qc.invalidateQueries({ queryKey: key });

  const save = useMutation({
    mutationFn: async (f: Form) => {
      requireManagedRole(company.role);
      const row = {
        name: f.name,
        metric: f.metric,
        operator: f.operator,
        threshold: f.threshold,
        guidance: f.guidance || null,
      };
      const { error } = f.id
        ? await supabase
            .from("rules")
            .update(row)
            .eq("id", f.id)
            .eq("company_id", company.id)
            .select("id")
            .single()
        : await supabase.from("rules").insert({ ...row, company_id: company.id });
      if (error) throw error;
    },
    onSuccess: () => {
      done();
      setForm(null);
      toast.success("Regra salva");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: async (r: Rule) => {
      requireManagedRole(company.role);
      const { error } = await supabase
        .from("rules")
        .update({ active: !r.active })
        .eq("id", r.id)
        .eq("company_id", company.id)
        .select("id")
        .single();
      if (error) throw error;
    },
    onSuccess: done,
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      requireManagedRole(company.role);
      const { error } = await supabase
        .from("rules")
        .delete()
        .eq("id", id)
        .eq("company_id", company.id)
        .select("id")
        .single();
      if (error) throw error;
    },
    onSuccess: () => {
      done();
      toast.success("Regra excluída");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Regras internas</h1>
          <p className="text-muted-foreground">Critérios que geram recomendações explicáveis.</p>
        </div>
        <Button disabled={!canManage(company.role)} onClick={() => setForm(blank)}>
          <Plus /> Nova regra
        </Button>
      </div>
      {rules.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            Nenhuma regra configurada ainda.
          </CardContent>
        </Card>
      )}
      <div className="grid gap-3">
        {rules.map((r) => {
          const v = metricValue(m, r.metric);
          const hit = r.active && compare(v, r.operator, r.threshold);
          return (
            <Card key={r.id} className={hit ? "border-gold" : ""}>
              <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{r.name}</p>
                    {hit && (
                      <span className="rounded-full bg-gold/30 px-2 py-0.5 text-xs text-gold-foreground">
                        Acionada
                      </span>
                    )}
                    {!r.active && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        Pausada
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Se <b>{METRIC_LABEL[r.metric]}</b> {OPERATOR_LABEL[r.operator]}{" "}
                    <b>{r.threshold}</b> · valor atual: {v}
                  </p>
                  {r.guidance && <p className="mt-2 text-sm">{r.guidance}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    disabled={!canManage(company.role) || toggle.isPending}
                    checked={r.active}
                    onCheckedChange={() => toggle.mutate(r)}
                    aria-label="Ativar regra"
                  />
                  <Button
                    disabled={!canManage(company.role) || del.isPending}
                    variant="ghost"
                    size="icon"
                    aria-label="Editar"
                    onClick={() =>
                      setForm({
                        id: r.id,
                        name: r.name,
                        metric: r.metric,
                        operator: r.operator,
                        threshold: r.threshold,
                        guidance: r.guidance ?? "",
                      })
                    }
                  >
                    <Pencil />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        disabled={!canManage(company.role) || del.isPending}
                        variant="ghost"
                        size="icon"
                        aria-label="Excluir"
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir regra “{r.name}”?</AlertDialogTitle>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => del.mutate(r.id)}>
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar regra" : "Nova regra"}</DialogTitle>
          </DialogHeader>
          {form && (
            <form
              id="rule"
              className="grid gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(form);
              }}
            >
              <div className="grid gap-2">
                <Label>Nome</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-[1fr_auto_6rem] gap-3">
                <div className="grid gap-2">
                  <Label>Métrica</Label>
                  <Select
                    value={form.metric}
                    onValueChange={(v) => setForm({ ...form, metric: v as Metric })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(METRIC_LABEL).map(([k, l]) => (
                        <SelectItem key={k} value={k}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Condição</Label>
                  <Select
                    value={form.operator}
                    onValueChange={(v) => setForm({ ...form, operator: v as Operator })}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(OPERATOR_LABEL).map(([k, l]) => (
                        <SelectItem key={k} value={k}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Limite</Label>
                  <Input
                    type="number"
                    min={0}
                    required
                    value={form.threshold}
                    onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Orientação para revisão humana</Label>
                <Textarea
                  placeholder="Ex.: Reavaliar prazos com os responsáveis na reunião semanal."
                  value={form.guidance}
                  onChange={(e) => setForm({ ...form, guidance: e.target.value })}
                />
              </div>
            </form>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="rule" disabled={save.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
