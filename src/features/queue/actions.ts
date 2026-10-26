"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getActor } from "@/server/session";
import { safeError } from "@/shared/lib/errors";
export async function queueOperation(input: unknown) {
  try {
    const p = z.object({ id: z.uuid(), key: z.uuid(), action: z.enum(["check_in", "call_next", "start", "complete", "skip", "requeue", "close"]), ticket: z.uuid().optional(), reason: z.string().trim().max(1000).optional() }).parse(input);
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    if (actor.role !== "admin") throw new Error("FORBIDDEN");
    const { error } = p.action === "check_in" ? await actor.client.rpc("check_in", { p_id: p.id, p_key: p.key, p_override_reason: p.reason || null }) : await actor.client.rpc("advance_queue", { p_session: p.id, p_action: p.action, p_key: p.key, p_ticket: p.ticket ?? null });
    if (error) throw error;
    revalidatePath("/admin/queue"); revalidatePath("/patient"); revalidatePath("/patient/appointments");
    return { ok: true, message: "Queue updated. The latest state is shown below." };
  } catch (error) { return { ok: false, message: error instanceof z.ZodError ? error.issues[0].message : safeError(error) }; }
}
