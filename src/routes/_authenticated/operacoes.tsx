import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/lib/company";
import { opsQuery } from "@/lib/data";
import { isOverdue, PRIORITY_LABEL, STATUS_LABEL, type Operation, type Priority, type Status } from "@/lib/nexus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/operacoes")({
  head: () => ({ meta: [{ title: "Operações — Nexus Workspace" }, { name: "description", content: "Gerencie as operações da empresa." }, { property: "og:title", content: "Operações — Nexus Workspace" }, { property: "og:description", content: "Gerencie as operações da empresa." }] }),
  component: Operacoes,
});

const empty = { title: "", category: "", owner_name: "", expected_impact: "", priority: "media" as Priority, status: "aberta" as Status, due_date: "" };

function Operacoes() {
  const company = useCompany();
  const qc = useQueryClient();
  const { data: ops = [] } = useQuery(opsQuery(company.id));
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"todas" | Status>("todas");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const key = opsQuery(company.id).queryKey;

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Operation> }) => {
      const { error } = await supabase.from("operations").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("operations").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("Operação removida"); },
  });
  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("operations").insert({
        company_id: company.id, title: form.title, category: form.category || "Geral", owner_name: form.owner_name || null,
        expected_impact: form.expected_impact || null, priority: form.priority, status: form.status, due_date: form.due_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); setOpen(false); setForm(empty); toast.success("Operação criada"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const term = q.toLowerCase();
  const list = ops.filter((o) => (filter === "todas" || o.status === filter) &&
    [o.title, o.category, o.owner_name ?? ""].some((v) => v.toLowerCase().includes(term)));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-semibold">Operações</h1><p className="text-muted-foreground">{ops.length} operações registradas.</p></div>
        <Button onClick={() => setOpen(true)}><Plus /> Nova operação</Button>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-8" placeholder="Buscar operações…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList><TabsTrigger value="todas">Todas</TabsTrigger><TabsTrigger value="aberta">Abertas</TabsTrigger><TabsTrigger value="andamento">Em andamento</TabsTrigger><TabsTrigger value="concluida">Concluídas</TabsTrigger></TabsList>
        </Tabs>
      </div>
      <Card className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Título</TableHead><TableHead>Categoria</TableHead><TableHead>Responsável</TableHead><TableHead>Prazo</TableHead><TableHead>Prioridade</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {list.length === 0 && <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">Nenhuma operação encontrada.</TableCell></TableRow>}
            {list.map((o) => (
              <TableRow key={o.id}>
                <TableCell><p className="font-medium">{o.title}</p>{o.expected_impact && <p className="text-xs text-muted-foreground">{o.expected_impact}</p>}</TableCell>
                <TableCell>{o.category}</TableCell>
                <TableCell>{o.owner_name || "—"}</TableCell>
                <TableCell className={isOverdue(o) ? "font-medium text-destructive" : ""}>{o.due_date ? new Date(o.due_date + "T12:00").toLocaleDateString("pt-BR") : "—"}</TableCell>
                <TableCell>
                  <Select value={o.priority} onValueChange={(v) => update.mutate({ id: o.id, patch: { priority: v as Priority } })}>
                    <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(PRIORITY_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select value={o.status} onValueChange={(v) => update.mutate({ id: o.id, patch: { status: v as Status } })}>
                    <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(STATUS_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" aria-label="Remover"><Trash2 className="text-destructive" /></Button></AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Remover operação?</AlertDialogTitle><AlertDialogDescription>“{o.title}” será excluída permanentemente.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => remove.mutate(o.id)}>Remover</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova operação</DialogTitle></DialogHeader>
          <form id="op" className="grid gap-4" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
            <div className="grid gap-2"><Label>Título</Label><Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Categoria</Label><Input placeholder="Ex.: Financeiro" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
              <div className="grid gap-2"><Label>Responsável</Label><Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} /></div>
            </div>
            <div className="grid gap-2"><Label>Impacto esperado</Label><Input value={form.expected_impact} onChange={(e) => setForm({ ...form, expected_impact: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2"><Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(PRIORITY_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="grid gap-2"><Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(STATUS_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="grid gap-2"><Label>Prazo</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            </div>
          </form>
          <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" form="op" disabled={create.isPending}>Criar operação</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
