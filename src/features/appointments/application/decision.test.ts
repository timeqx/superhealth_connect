import { describe, expect, it } from "vitest";
import { appointmentDecisionSchema } from "./decision";
const input = {
  id: "30000000-0000-4000-8000-000000000001",
  key: "40000000-0000-4000-8000-000000000001",
  expected: "2026-10-21T01:00:00.123456+00:00",
  decision: "approve", reason: "",
};
describe("appointment decision input", () => {
  it("preserves the exact database timestamp and retry key", () => {
    const result = appointmentDecisionSchema.parse(input);
    expect(result.expected).toBe(input.expected);
    expect(result.key).toBe(input.key);
  });
  it("requires a nonblank explanation for rejection", () => {
    expect(appointmentDecisionSchema.safeParse({ ...input, decision: "reject", reason: "   " }).success).toBe(false);
    expect(appointmentDecisionSchema.parse({ ...input, decision: "reject", reason: " Choose another session. " }).reason).toBe("Choose another session.");
  });
  it("rejects unrelated operations and missing optimistic concurrency versions", () => {
    expect(appointmentDecisionSchema.safeParse({ ...input, decision: "check_in" }).success).toBe(false);
    expect(appointmentDecisionSchema.safeParse({ ...input, expected: "" }).success).toBe(false);
    expect(appointmentDecisionSchema.safeParse({ ...input, key: "" }).success).toBe(false);
  });
  it("does not accept role or patient identity as trusted operation input", () => {
    const result = appointmentDecisionSchema.parse({ ...input, role: "admin", patient_id: input.id });
    expect(result).not.toHaveProperty("role");
    expect(result).not.toHaveProperty("patient_id");
  });
});
