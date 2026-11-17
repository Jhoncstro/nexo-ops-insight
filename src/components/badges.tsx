import { cn } from "@/lib/utils";
import { PRIORITY_LABEL, STATUS_LABEL, type Priority, type Status } from "@/lib/nexus";

export function StatusBadge({ s }: { s: Status }) {
  const c = { aberta: "bg-secondary text-secondary-foreground", andamento: "bg-gold/25 text-gold-foreground", concluida: "bg-accent text-accent-foreground" }[s];
  return <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", c)}>{STATUS_LABEL[s]}</span>;
}
export function PriorityBadge({ p }: { p: Priority }) {
  const c = { baixa: "text-muted-foreground", media: "text-foreground", alta: "text-destructive font-semibold" }[p];
  return <span className={cn("text-xs", c)}>{PRIORITY_LABEL[p]}</span>;
}
