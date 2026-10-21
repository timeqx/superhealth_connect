import { describe, expect, it } from "vitest";
import { reportRange } from "./report-range";
describe("Manila report boundaries", () => {
  it("includes the entire selected local day", () => {
    expect(reportRange("2026-10-21", "2026-10-21")).toEqual({ start: "2026-10-20T16:00:00.000Z", end: "2026-10-21T16:00:00.000Z" });
  });
  it("rejects impossible dates, reversed ranges and oversized exports", () => {
    for (const [from,to] of [["2026-02-30","2026-03-01"],["2026-10-22","2026-10-21"],["2026-01-01","2026-12-31"],["=SUM(1)","2026-10-21"]]) expect(reportRange(from,to)).toBeNull();
  });
});
