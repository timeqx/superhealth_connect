import { z } from "zod";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a valid time.");
const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));

export const serviceScheduleSchema = z.object({
  open: time,
  close: time,
  duration: z.coerce.number().int().min(1, "Session duration must be at least 1 minute.").max(1440),
  capacity: z.coerce.number().int().min(1, "Each session must have at least 1 patient slot.").max(500),
  days: z.array(z.coerce.number().int().min(0).max(6)).max(7),
}).superRefine((value, context) => {
  if (value.open >= value.close) {
    context.addIssue({ code: "custom", path: ["close"], message: "Closing time must be after opening time." });
  } else if (value.duration > minutes(value.close) - minutes(value.open)) {
    context.addIssue({ code: "custom", path: ["duration"], message: "Session duration must fit within the service hours." });
  }
});
