"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getActor } from "@/server/session";
import { safeError } from "@/shared/lib/errors";
import { manilaInputToUtc } from "@/shared/lib/time";

export async function saveOperations(kind: "service" | "slot", input: unknown) {
  try {
    const actor = await getActor();
    if (!actor || actor.role !== "admin") throw new Error("FORBIDDEN");
    let error;
    if (kind === "service") {
      const p = z.object({ id: z.uuid(), published: z.boolean(), bookable: z.boolean(), requirements: z.string().trim().min(1).max(2000), arrival: z.coerce.number().int().min(0).max(240) }).parse(input);
      ({ error } = await actor.client.rpc("update_service", { p_id: p.id, p_published: p.published, p_bookable: p.bookable, p_requirements: p.requirements, p_arrival: p.arrival }));
    } else if (kind === "slot") {
      const p = z.object({ id: z.uuid().nullable(), service: z.uuid(), start: z.string(), end: z.string(), capacity: z.coerce.number().int().min(1).max(500), open: z.boolean(), expected: z.string().nullable(), key: z.uuid() }).parse(input);
      // Existing instants are preserved exactly; changing a session's time requires a new slot.
      const start = p.id ? z.iso.datetime({ offset: true }).parse(p.start) : manilaInputToUtc(p.start);
      const end = p.id ? z.iso.datetime({ offset: true }).parse(p.end) : manilaInputToUtc(p.end);
      ({ error } = await actor.client.rpc("save_slot", { p_id: p.id, p_service: p.service, p_start: start, p_end: end, p_capacity: p.capacity, p_open: p.open, p_expected: p.expected, p_key: p.key }));
    } else throw new Error("VALIDATION_ERROR");
    if (error) throw error;
    for (const path of ["/admin/schedules", "/services", "/patient/book"]) revalidatePath(path);
    return { ok: true, message: "Changes saved." };
  } catch (error) { return { ok: false, message: error instanceof z.ZodError ? error.issues[0].message : safeError(error) }; }
}
