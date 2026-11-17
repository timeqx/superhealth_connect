import { z } from "zod";

export const appointmentDecisionSchema = z.object({
  id: z.uuid(),
  decision: z.enum(["approve", "reject"]),
  expected: z.iso.datetime({ offset: true }),
  key: z.uuid(),
  target: z.uuid().nullable().optional(),
  reason: z.string().trim().max(1000),
}).refine(value => value.decision !== "reject" || value.reason.length > 0, {
  path: ["reason"],
  message: "Enter a reason so the patient understands why the request was declined.",
});

export const bulkAppointmentDecisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(1000),
  requests: z.array(z.object({
    id: z.uuid(),
    expected: z.iso.datetime({ offset: true }),
    key: z.uuid(),
  })).min(1, "Select at least one appointment request.").max(25, "Select up to 25 requests at a time."),
}).refine(value => value.decision !== "reject" || value.reason.length > 0, {
  path: ["reason"],
  message: "Enter a reason so each patient understands why the request was declined.",
}).refine(value => new Set(value.requests.map(request => request.id)).size === value.requests.length, {
  path: ["requests"], message: "Each request can only be selected once.",
}).refine(value => new Set(value.requests.map(request => request.key)).size === value.requests.length, {
  path: ["requests"], message: "Each request needs its own retry key. Refresh and try again.",
});

export type BulkDecisionResult = {
  ok: boolean;
  message: string;
  results: { id: string; ok: boolean; message: string }[];
};
