import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocked = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocked.from, auth: { getUser: mocked.getUser } },
}));
vi.mock("./security", () => ({ teamsEnabled: false, securityClient: {} }));
import { companiesQuery, opsQuery } from "./data";

beforeEach(() => vi.resetAllMocks());
describe("Data isolation and pagination", () => {
  it("uses a distinct company cache for each authenticated identity and rejects an identity change", async () => {
    expect(companiesQuery("a").queryKey).not.toEqual(companiesQuery("b").queryKey);
    mocked.getUser.mockResolvedValue({ data: { user: { id: "b" } }, error: null });
    await expect(
      new QueryClient({ defaultOptions: { queries: { retry: false } } }).fetchQuery(
        companiesQuery("a"),
      ),
    ).rejects.toThrow("Sessão expirada");
    expect(mocked.from).not.toHaveBeenCalled();
  });
  it("fetches past the first API page with a company filter and cancellation signal on every page", async () => {
    const ranges: number[][] = [];
    const filters: string[][] = [];
    const signals: AbortSignal[] = [];
    let page = 0;
    const builder = {
      select: () => builder,
      order: () => builder,
      eq: (field: string, value: string) => {
        filters.push([field, value]);
        return builder;
      },
      range: (start: number, end: number) => {
        ranges.push([start, end]);
        return builder;
      },
      abortSignal: (signal: AbortSignal) => {
        signals.push(signal);
        return Promise.resolve({
          data: page++ === 0 ? Array.from({ length: 500 }, (_, id) => ({ id })) : [{ id: 500 }],
          error: null,
        });
      },
    };
    mocked.from.mockReturnValue(builder);
    const data = await new QueryClient().fetchQuery(opsQuery("tenant-a"));
    expect(data).toHaveLength(501);
    expect(ranges).toEqual([
      [0, 499],
      [500, 999],
    ]);
    expect(filters).toEqual([
      ["company_id", "tenant-a"],
      ["company_id", "tenant-a"],
    ]);
    expect(signals).toHaveLength(2);
    expect(signals.every((s) => s instanceof AbortSignal)).toBe(true);
  });
  it("propagates API failures instead of presenting partial metrics as complete", async () => {
    const builder = {
      select: () => builder,
      eq: () => builder,
      order: () => builder,
      range: () => builder,
      abortSignal: () => Promise.resolve({ data: null, error: new Error("denied") }),
    };
    mocked.from.mockReturnValue(builder);
    await expect(
      new QueryClient({ defaultOptions: { queries: { retry: false } } }).fetchQuery(
        opsQuery("tenant-a"),
      ),
    ).rejects.toThrow("denied");
  });
});
