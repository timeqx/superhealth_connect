"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActor } from "@/server/session";
import { safeError, type ActionResult } from "@/shared/lib/errors";
import { appointmentDecisionSchema } from "./decision";

export async function decideAppointment(input: unknown): Promise<ActionResult> {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    if (actor.role !== "admin") throw new Error("FORBIDDEN");
    const p = appointmentDecisionSchema.parse(input);
    const { error } = await actor.client.rpc("change_appointment", {
      p_id: p.id, p_action: p.decision, p_key: p.key,
      p_expected: p.expected, p_reason: p.reason || null,
      p_target: p.decision === "reject" ? p.target ?? null : null,
    });
    if (error) throw error;
    revalidatePath("/admin");
    revalidatePath("/patient");
    revalidatePath("/patient/appointments");
    return { ok: true, message: p.decision === "approve"
      ? "Appointment approved and scheduled. A queue ticket will be issued at staff check-in."
      : "Request declined. The patient can see your reason in their appointments." };
  } catch (error) {
    return { ok: false, message: error instanceof z.ZodError ? error.issues[0].message : safeError(error) };
  }
}
