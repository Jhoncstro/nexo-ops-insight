import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NewCompanyForm({ onCreated }: { onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", sector: "", location: "" });
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.from("companies").insert(f).select().single();
    setBusy(false);
    if (error) { toast.error("Erro ao cadastrar empresa", { description: error.message }); return; }
    await qc.invalidateQueries({ queryKey: ["companies"] });
    toast.success("Empresa cadastrada");
    onCreated(data.id);
  }
  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="grid gap-2"><Label>Nome</Label><Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div className="grid gap-2"><Label>Setor</Label><Input placeholder="Ex.: Varejo" value={f.sector} onChange={(e) => setF({ ...f, sector: e.target.value })} /></div>
      <div className="grid gap-2"><Label>Localização</Label><Input placeholder="Ex.: São Paulo, SP" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
      <Button type="submit" disabled={busy}>Cadastrar empresa</Button>
    </form>
  );
}
