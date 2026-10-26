"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getActor } from "@/server/session";
import { safeError } from "@/shared/lib/errors";
export async function manageVisit(input: unknown) {
  try {
    const p = z.object({ id: z.uuid(), expected: z.iso.datetime({ offset: true }), key: z.uuid(), action: z.enum(["cancel", "reschedule"]), reason: z.string().trim().max(1000), target: z.uuid().optional() }).parse(input);
    if (p.action === "cancel" && !p.reason) return { ok: false, message: "Enter a cancellation reason." };
    if (p.action === "reschedule" && !p.target) return { ok: false, message: "Choose another session." };
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    const { error } = await actor.client.rpc("change_appointment", { p_id: p.id, p_expected: p.expected, p_key: p.key, p_action: p.action, p_reason: p.reason || null, p_target: p.target ?? null });
    if (error) throw error;
    revalidatePath("/patient"); revalidatePath("/patient/appointments"); revalidatePath("/admin");
    return { ok: true, message: p.action === "cancel" ? "Appointment cancelled." : "Session changed. Your appointment is pending staff approval again." };
  } catch (error) { return { ok: false, message: error instanceof z.ZodError ? error.issues[0].message : safeError(error) }; }
}
export async function visitAlternatives(id: string) {
  try {
    z.uuid().parse(id);
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    const { data, error } = await actor.client.from("appointments").select("slot_id,service_slots!appointments_slot_id_fkey(service_id)").eq("id", id).eq("patient_id", actor.user.id).single();
    if (error) throw error;
    const slot = data.service_slots as unknown as { service_id: string };
    const result = await actor.client.rpc("slot_availability", { p_service: slot.service_id });
    if (result.error) throw result.error;
    return { ok: true as const, slots: (result.data as import("../domain/appointment").Slot[]).filter(s => s.id !== data.slot_id) };
  } catch (error) { return { ok: false as const, message: safeError(error) }; }
}
