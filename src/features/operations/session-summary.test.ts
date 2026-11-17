import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Slot } from "./forms";
import { groupServiceSessions, loadUpcomingSessions, sessionDateRange } from "./session-summary";

function session(index: number, overrides: Partial<Slot> = {}): Slot {
  return { id: `session-${index}`, service_id: "consultation", starts_at: `2099-01-01T${String(8 + index).padStart(2, "0")}:00:00+08:00`, ends_at: `2099-01-01T${String(9 + index).padStart(2, "0")}:00:00+08:00`, capacity: 6, is_open: true, updated_at: "2098-12-01T00:00:00Z", ...overrides };
}

describe("upcoming daily service summaries", () => {
  it("combines eight hourly sessions into one ordered daily summary", () => {
    const sessions = Array.from({ length: 8 }, (_, i) => session(i, { is_open: i !== 3 }));
    const groups = groupServiceSessions([...sessions].reverse());
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ date: "2099-01-01", serviceId: "consultation", capacity: 48, openCount: 7, startsAt: sessions[0].starts_at, endsAt: sessions[7].ends_at });
    expect(groups[0].sessions).toEqual(sessions);
  });

  it("separates services and uses Manila dates rather than UTC dates", () => {
    const groups = groupServiceSessions([
      session(0), session(1, { service_id: "dental" }),
      session(2, { starts_at: "2099-01-01T16:30:00Z", ends_at: "2099-01-01T17:30:00Z" }),
    ]);
    expect(groups.map(group => [group.date, group.serviceId])).toEqual([
      ["2099-01-01", "consultation"], ["2099-01-01", "dental"], ["2099-01-02", "consultation"],
    ]);
    expect(groupServiceSessions([])).toEqual([]);
  });

  it("filters an entire Manila date with an exclusive next-day boundary", () => {
    expect(sessionDateRange("2028-02-29")).toEqual({ start: "2028-02-28T16:00:00.000Z", end: "2028-02-29T16:00:00.000Z" });
    for (const date of ["2027-02-29", "2028-02-30", "invalid", "2028-13-01"]) expect(() => sessionDateRange(date)).toThrow();
  });

  it("loads complete groups beyond one API page and applies the date bounds", async () => {
    const rows = Array.from({ length: 501 }, (_, i) => session(0, { id: `row-${i}`, capacity: 1 }));
    const query = {
      select: vi.fn().mockReturnThis(), gt: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(), lt: vi.fn().mockReturnThis(),
      range: vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, to + 1), error: null })),
    };
    const client = { from: vi.fn(() => query) } as unknown as SupabaseClient;
    const loaded = await loadUpcomingSessions(client, "2098-12-31T00:00:00Z", "2099-01-01");
    expect(loaded).toHaveLength(501);
    expect(groupServiceSessions(loaded)[0].capacity).toBe(501);
    expect(query.range.mock.calls).toEqual([[0, 499], [500, 999]]);
    expect(query.gte).toHaveBeenCalledWith("starts_at", "2098-12-31T16:00:00.000Z");
    expect(query.lt).toHaveBeenCalledWith("starts_at", "2099-01-01T16:00:00.000Z");
  });

  it("does not show incomplete summaries when loading fails", async () => {
    const query = { select: vi.fn().mockReturnThis(), gt: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data: null, error: { message: "unavailable" } }) };
    await expect(loadUpcomingSessions({ from: () => query } as unknown as SupabaseClient, "2098-12-31T00:00:00Z")).rejects.toThrow("Upcoming sessions could not be loaded.");
  });
});
