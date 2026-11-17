export type Status = "aberta" | "andamento" | "concluida";
export type Priority = "baixa" | "media" | "alta";
export type Metric = "atrasadas" | "alta" | "abertas";
export type Operator = ">" | ">=" | "<" | "<=";

export interface Operation {
  id: string;
  company_id: string;
  title: string;
  category: string;
  owner_name: string | null;
  expected_impact: string | null;
  priority: Priority;
  status: Status;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Rule {
  id: string;
  company_id: string;
  name: string;
  metric: Metric;
  operator: Operator;
  threshold: number;
  guidance: string | null;
  active: boolean;
}

export const STATUS_LABEL: Record<Status, string> = { aberta: "Aberta", andamento: "Em andamento", concluida: "Concluída" };
export const PRIORITY_LABEL: Record<Priority, string> = { baixa: "Baixa", media: "Média", alta: "Alta" };
export const METRIC_LABEL: Record<Metric, string> = {
  atrasadas: "Operações fora do prazo",
  alta: "Operações de prioridade alta",
  abertas: "Operações em aberto",
};
export const OPERATOR_LABEL: Record<Operator, string> = { ">": ">", ">=": "≥", "<": "<", "<=": "≤" };

export function isOverdue(op: Operation, today = new Date()): boolean {
  if (op.status === "concluida" || !op.due_date) return false;
  const t = today.toISOString().slice(0, 10);
  return op.due_date < t;
}

export function computeMetrics(ops: Operation[], today = new Date()) {
  const pending = ops.filter((o) => o.status !== "concluida");
  const done = ops.length - pending.length;
  return {
    total: ops.length,
    abertas: ops.filter((o) => o.status === "aberta").length,
    andamento: ops.filter((o) => o.status === "andamento").length,
    concluidas: done,
    atrasadas: ops.filter((o) => isOverdue(o, today)).length,
    alta: pending.filter((o) => o.priority === "alta").length,
    pendentes: pending.length,
    ritmo: ops.length ? Math.round((done / ops.length) * 100) : 0,
  };
}

export type Metrics = ReturnType<typeof computeMetrics>;

export function metricValue(m: Metrics, metric: Metric): number {
  return metric === "abertas" ? m.pendentes : m[metric];
}

export function compare(value: number, op: Operator, threshold: number): boolean {
  switch (op) {
    case ">": return value > threshold;
    case ">=": return value >= threshold;
    case "<": return value < threshold;
    case "<=": return value <= threshold;
  }
}

export interface Recommendation { rule: Rule; value: number; explanation: string }

export function evaluateRules(rules: Rule[], m: Metrics): Recommendation[] {
  return rules
    .filter((r) => r.active)
    .map((r) => ({ rule: r, value: metricValue(m, r.metric) }))
    .filter(({ rule, value }) => compare(value, rule.operator, rule.threshold))
    .map(({ rule, value }) => ({
      rule,
      value,
      explanation: `${METRIC_LABEL[rule.metric]} = ${value}, critério ${OPERATOR_LABEL[rule.operator]} ${rule.threshold}.`,
    }));
}

export function toCsv(ops: Operation[]): string {
  const head = ["Título", "Categoria", "Responsável", "Impacto esperado", "Prioridade", "Status", "Prazo", "Criada em"];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = ops.map((o) =>
    [o.title, o.category, o.owner_name ?? "", o.expected_impact ?? "", PRIORITY_LABEL[o.priority], STATUS_LABEL[o.status], o.due_date ?? "", o.created_at.slice(0, 10)].map(esc).join(","),
  );
  return [head.map(esc).join(","), ...rows].join("\n");
}
