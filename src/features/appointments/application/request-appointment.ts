import type { AppointmentRepository } from "../domain/appointment";
import { z } from "zod";
const requestSchema = z.object({ slotId: z.uuid(), key: z.uuid() });
export async function requestAppointment(
  repository: AppointmentRepository,
  input: unknown,
) {
  const { slotId, key } = requestSchema.parse(input);
  return repository.request(slotId, key);
}
