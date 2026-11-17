import { describe, expect, it } from "vitest";
import { displayDateInput, parseDateInput, shiftDate } from "./date-field";
import { formatDate } from "./time";

describe("month-first date fields", () => {
  it("displays month/day/year while preserving ISO values for submissions", () => {
    expect(displayDateInput("2026-11-18")).toBe("11/18/2026");
    expect(parseDateInput("11/18/2026")).toBe("2026-11-18");
    expect(parseDateInput("1/2/2026")).toBe("2026-01-02");
    expect(formatDate("2026-11-17T16:00:00Z")).toBe("Wed, November 18, 2026");
  });
  it("rejects impossible dates rather than rolling them into the next month", () => {
    for (const value of ["02/29/2026", "02/30/2028", "13/01/2026", "11/00/2026", "11/18/26", "01/01/0000", ""]) expect(parseDateInput(value)).toBeNull();
    expect(parseDateInput("02/29/2028")).toBe("2028-02-29");
  });
  it("moves between days across month, year, and leap-day boundaries", () => {
    expect(shiftDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDate("2027-01-01", -1)).toBe("2026-12-31");
    expect(shiftDate("2028-03-01", -1)).toBe("2028-02-29");
    expect(shiftDate("2026-03-01", -1)).toBe("2026-02-28");
  });
});
