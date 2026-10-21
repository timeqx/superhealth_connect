import { z } from "zod";

export const appointmentDecisionSchema = z.object({
  id: z.uuid(),
  decision: z.enum(["approve", "reject"]),
  expected: z.iso.datetime({ offset: true }),
  key: z.uuid(),
  reason: z.string().trim().max(1000),
}).refine(value => value.decision !== "reject" || value.reason.length > 0, {
  path: ["reason"],
  message: "Enter a reason so the patient understands why the request was declined.",
});
