import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import { ACTIVE_COMPANY_KEY, clearSessionCache } from "./session-cache";

describe("Session isolation", () => {
  it("cancels an in-flight query and clears data and company selection", async () => {
    const client = new QueryClient();
    localStorage.setItem(ACTIVE_COMPANY_KEY, "private-company");
    client.setQueryData(["companies"], [{ id: "private-company" }]);
    let aborted = false;
    const pending = client
      .fetchQuery({
        queryKey: ["ops", "private-company"],
        queryFn: ({ signal }) =>
          new Promise((_, reject) => {
            signal.addEventListener("abort", () => {
              aborted = true;
              reject(new Error("aborted"));
            });
          }),
      })
      .catch(() => undefined);
    clearSessionCache(client);
    await pending;
    expect(aborted).toBe(true);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(localStorage.getItem(ACTIVE_COMPANY_KEY)).toBeNull();
  });
});
