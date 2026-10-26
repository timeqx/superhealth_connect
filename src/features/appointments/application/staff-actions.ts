"use server";
import { z } from "zod";
import { getActor } from "@/server/session";
import { revalidatePath } from "next/cache";
import { safeError } from "@/shared/lib/errors";
export async function staffBook(input: unknown) {
  try {
    const p = z.object({ patient: z.uuid(), slot: z.uuid(), reason: z.string().trim().min(1).max(1000), key: z.uuid() }).parse(input);
    const actor = await getActor();
    if (!actor || actor.role !== "admin") throw new Error("FORBIDDEN");
    const { error } = await actor.client.rpc("staff_request_appointment", { p_patient: p.patient, p_slot: p.slot, p_reason: p.reason, p_key: p.key });
    if (error) throw error;
    for (const path of ["/admin", "/admin/book", "/admin/history", "/patient/appointments"]) revalidatePath(path);
    return { ok: true, message: "Request created. Review and approve it in Appointment requests to schedule the visit." };
  } catch (error) { return { ok: false, message: error instanceof z.ZodError ? error.issues[0].message : safeError(error) }; }
}
export async function staffAppointmentAction(input: unknown) {
  try {
    const p = z.object({ id: z.uuid(), expected: z.iso.datetime({ offset: true }), action: z.enum(["cancel", "no_show"]), reason: z.string().trim().min(1, "Explain the reason for this change.").max(1000), key: z.uuid() }).parse(input);
    const actor = await getActor();
    if (!actor || actor.role !== "admin") throw new Error("FORBIDDEN");
    const { error } = await actor.client.rpc("change_appointment", { p_id: p.id, p_expected: p.expected, p_action: p.action, p_reason: p.reason, p_key: p.key });
    if (error) throw error;
    for (const path of ["/admin", "/admin/history", "/admin/queue", "/patient", "/patient/appointments"]) revalidatePath(path);
    return { ok: true, message: "Appointment updated. The patient will see the reason." };
  } catch (error) { return { ok: false, message: error instanceof z.ZodError ? error.issues[0].message : safeError(error) }; }
}

export async function staffAlternatives(id: string) {
  const actor = await getActor();
  if (!actor || actor.role !== "admin") throw new Error("FORBIDDEN");
  const visit = await actor.client.from("appointments").select("slot_id,service_slots!appointments_slot_id_fkey(service_id)").eq("id", z.uuid().parse(id)).single();
  if (visit.error) throw new Error("Could not load this appointment.");
  const slot = visit.data.service_slots as unknown as { service_id: string };
  const result = await actor.client.rpc("slot_availability", { p_service: slot.service_id }).neq("id", visit.data.slot_id).gt("remaining", 0).order("starts_at").limit(50);
  if (result.error) throw new Error("Alternatives could not be loaded.");
  return result.data as { id: string; starts_at: string; ends_at: string }[];
}
