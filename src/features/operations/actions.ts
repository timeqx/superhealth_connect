"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getActor } from "@/server/session";
import { safeError } from "@/shared/lib/errors";
import { manilaInputToUtc } from "@/shared/lib/time";

export async function saveDefinition(input: unknown) {
  try {
    const p = z.object({ id: z.uuid().nullable(), expected: z.iso.datetime({ offset: true }).nullable(), name: z.string().trim().min(2).max(120), slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(100), description: z.string().trim().min(1).max(2000), key: z.uuid() }).parse(input);
    const actor = await getActor();
    if (!actor || actor.role !== "admin") throw new Error("FORBIDDEN");
    const { error } = await actor.client.rpc("save_service_definition", { p_id: p.id, p_name: p.name, p_slug: p.slug, p_description: p.description, p_expected: p.expected, p_key: p.key });
    if (error) throw error;
    revalidatePath("/admin/schedules"); revalidatePath("/services");
    return { ok: true, message: "Service details saved. New services stay unpublished until you publish them." };
  } catch (error) { return { ok: false, message: error instanceof z.ZodError ? error.issues[0].message : safeError(error) }; }
}

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
      const start = manilaInputToUtc(p.start);
      const end = manilaInputToUtc(p.end);
      ({ error } = await actor.client.rpc("save_slot", { p_id: p.id, p_service: p.service, p_start: start, p_end: end, p_capacity: p.capacity, p_open: p.open, p_expected: p.expected, p_key: p.key }));
    } else throw new Error("VALIDATION_ERROR");
    if (error) throw error;
    for (const path of ["/admin/schedules", "/services", "/patient/book"]) revalidatePath(path);
    return { ok: true, message: "Changes saved." };
  } catch (error) { return { ok: false, message: error instanceof z.ZodError ? error.issues[0].message : safeError(error) }; }
}

export async function saveServiceSchedule(input: unknown) {
  try {
    const p = z.object({ service: z.uuid(), open: z.string().regex(/^\d{2}:\d{2}$/), close: z.string().regex(/^\d{2}:\d{2}$/), capacity: z.coerce.number().int().min(1).max(500), days: z.array(z.coerce.number().int().min(0).max(6)).max(7), expected: z.string(), key: z.uuid() }).parse(input);
    if (p.open >= p.close) return { ok: false, message: "Closing time must be after opening time." };
    const actor = await getActor();
    if (!actor || actor.role !== "admin") throw new Error("FORBIDDEN");
    const { error } = await actor.client.rpc("save_service_schedule", { p_service: p.service, p_open: p.open, p_close: p.close, p_capacity: p.capacity, p_days: p.days, p_expected: p.expected, p_key: p.key });
    if (error) throw error;
    for (const path of ["/admin/schedules", "/services", "/patient/book", "/admin/book"]) revalidatePath(path);
    return { ok: true, message: "Schedule saved. Existing appointments and date-specific overrides keep their settings." };
  } catch (error) { return { ok: false, message: error instanceof z.ZodError ? error.issues[0].message : safeError(error) }; }
}
