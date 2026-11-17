"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getActor } from "@/server/session";
import { safeError, type ActionResult } from "@/shared/lib/errors";
import { appointmentDecisionSchema, bulkAppointmentDecisionSchema, type BulkDecisionResult } from "./decision";

function refreshAppointmentViews() {
  for (const path of ["/admin", "/admin/history", "/admin/book", "/admin/queue", "/patient", "/patient/appointments", "/patient/notifications", "/patient/book"]) {
    revalidatePath(path);
  }
}

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
    refreshAppointmentViews();
    return { ok: true, message: p.decision === "approve"
      ? "Appointment approved and scheduled. A queue ticket will be issued at staff check-in."
      : "Request declined. The patient can see your reason in their appointments." };
  } catch (error) {
    return { ok: false, message: error instanceof z.ZodError ? error.issues[0].message : safeError(error) };
  }
}

export async function bulkDecideAppointments(input: unknown): Promise<BulkDecisionResult> {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    if (actor.role !== "admin") throw new Error("FORBIDDEN");
    const p = bulkAppointmentDecisionSchema.parse(input);
    const results: BulkDecisionResult["results"] = [];
    // Each decision uses the existing database authorization, version check,
    // capacity locks, notification and retry receipt. A stale row must not stop
    // staff from deciding the other requests in their selection.
    for (let offset = 0; offset < p.requests.length; offset += 5) {
      const batch = await Promise.all(p.requests.slice(offset, offset + 5).map(async request => {
        try {
          const { error } = await actor.client.rpc("change_appointment", {
            p_id: request.id, p_action: p.decision, p_key: request.key,
            p_expected: request.expected, p_reason: p.reason || null, p_target: null,
          });
          if (error) throw error;
          return { id: request.id, ok: true, message: p.decision === "approve" ? "Appointment approved." : "Request declined." };
        } catch (error) {
          return { id: request.id, ok: false, message: safeError(error) };
        }
      }));
      results.push(...batch);
    }
    const saved = results.filter(result => result.ok).length;
    if (saved) refreshAppointmentViews();
    const failed = results.length - saved;
    const outcome = p.decision === "approve" ? "approved" : "declined";
    return {
      ok: failed === 0,
      message: `${saved} ${saved === 1 ? "request" : "requests"} ${outcome}.${failed ? ` ${failed} could not be updated. Review the messages and refresh before retrying.` : " Patients can see the decision in their appointments."}`,
      results,
    };
  } catch (error) {
    return { ok: false, message: error instanceof z.ZodError ? error.issues[0].message : safeError(error), results: [] };
  }
}
