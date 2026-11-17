import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAvailableSlots } from "./slot-availability";

describe("time slot availability pagination", () => {
  it("loads dates beyond the API row limit", async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => ({ id: `slot-${i}`, starts_at: new Date(Date.UTC(2099, 0, 1, 0, i)).toISOString(), ends_at: new Date(Date.UTC(2099, 0, 1, 0, i + 1)).toISOString(), remaining: 3 }));
    let after = "";
    const query = {
      order: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
      gt: vi.fn((_column: string, value: string) => { after = value; return query; }),
      then: (resolve: (value: unknown) => void) => resolve({ data: rows.filter(row => row.starts_at > after).slice(0, 500), error: null }),
    };
    const client = { rpc: vi.fn(() => query) };
    expect(await loadAvailableSlots(client as unknown as SupabaseClient, "service-id")).toEqual(rows);
    expect(query.gt.mock.calls).toEqual([["starts_at", rows[499].starts_at], ["starts_at", rows[999].starts_at]]);
    expect(query.limit).toHaveBeenCalledWith(500);
    expect(query.order).toHaveBeenCalledWith("starts_at");
  });

  it("reports errors rather than returning a partial schedule", async () => {
    const error = new Error("Availability unavailable");
    const query = { order: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue({ data: null, error }) };
    const client = { rpc: vi.fn(() => query) };
    await expect(loadAvailableSlots(client as unknown as SupabaseClient, "service-id")).rejects.toThrow(error);
  });
});
