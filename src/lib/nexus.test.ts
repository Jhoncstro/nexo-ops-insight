import { describe, expect, it } from "vitest";
import { compare, computeMetrics, evaluateRules, type Operation, type Rule } from "./nexus";

const op = (p: Partial<Operation>): Operation => ({
  id: Math.random().toString(), company_id: "c", title: "t", category: "Geral", owner_name: null,
  expected_impact: null, priority: "media", status: "aberta", due_date: null, completed_at: null,
  created_at: "2026-01-01T00:00:00Z", ...p,
});
const today = new Date("2026-11-17T12:00:00Z");

describe("nexus rules", () => {
  it("counts overdue only for unfinished ops past due date", () => {
    const m = computeMetrics([
      op({ due_date: "2026-11-10" }),
      op({ due_date: "2026-11-10", status: "concluida" }),
      op({ due_date: "2026-11-20" }),
    ], today);
    expect(m.atrasadas).toBe(1);
  });
  it("ritmo is % concluded", () => {
    expect(computeMetrics([op({ status: "concluida" }), op({}), op({}), op({})], today).ritmo).toBe(25);
  });
  it("supports ≥ and ≤ comparisons", () => {
    expect(compare(3, ">=", 3)).toBe(true);
    expect(compare(3, ">", 3)).toBe(false);
    expect(compare(2, "<=", 1)).toBe(false);
  });
  it("paused rules never trigger", () => {
    const r: Rule = { id: "r", company_id: "c", name: "x", metric: "abertas", operator: ">=", threshold: 0, guidance: null, active: false };
    expect(evaluateRules([r], computeMetrics([op({})], today))).toHaveLength(0);
    expect(evaluateRules([{ ...r, active: true }], computeMetrics([op({})], today))).toHaveLength(1);
  });
});
