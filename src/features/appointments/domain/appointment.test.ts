import { describe, it, expect } from "vitest";
import {
  canTransition,
  reservesCapacity,
  appointmentStates,
} from "./appointment";
import { manilaDate, manilaInputToUtc } from "../../../shared/lib/time";
import {
  normalizePhone,
  profileSchema,
  inspectDocument,
} from "../../accounts/domain/validation";
describe("appointment rules", () => {
  it("requires approval and check-in before service", () => {
    expect(canTransition("pending", "checked_in")).toBe(false);
    expect(canTransition("pending", "scheduled")).toBe(true);
    expect(canTransition("scheduled", "checked_in")).toBe(true);
    expect(canTransition("checked_in", "completed")).toBe(false);
  });
  it("terminal states cannot reopen", () => {
    for (const state of [
      "completed",
      "cancelled",
      "rejected",
      "no_show",
    ] as const)
      for (const target of appointmentStates)
        expect(canTransition(state, target)).toBe(false);
  });
  it("pending and completed reserve capacity", () => {
    expect(reservesCapacity("pending")).toBe(true);
    expect(reservesCapacity("completed")).toBe(true);
    expect(reservesCapacity("no_show")).toBe(false);
  });
});
describe("Manila dates and account validation", () => {
  it("uses Manila midnight rather than UTC date", () => {
    expect(manilaDate("2026-10-20T16:01:00Z")).toBe("2026-10-21");
    expect(manilaInputToUtc("2026-10-21T09:00")).toBe(
      "2026-10-21T01:00:00.000Z",
    );
  });
  it("normalizes phone and requires Others detail", () => {
    expect(normalizePhone("0917 123 4567")).toBe("+639171234567");
    expect(
      profileSchema.safeParse({
        first: "Sample",
        middle: "",
        last: "Patient",
        barangay: "Others",
        other: "",
        phone: "09171234567",
      }).success,
    ).toBe(false);
  });
  it("rejects extension/content mismatch and empty files", () => {
    expect(() =>
      inspectDocument(new Uint8Array(), "id.pdf", "application/pdf"),
    ).toThrow();
    expect(() =>
      inspectDocument(
        new TextEncoder().encode("%PDF-test"),
        "id.png",
        "image/png",
      ),
    ).toThrow();
  });
});
