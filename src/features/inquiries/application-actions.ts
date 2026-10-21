"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getActor } from "@/server/session";
import { safeError } from "@/shared/lib/errors";
export async function replyInquiry(input: unknown) {
  try {
    const p = z.object({ id: z.uuid(), draft: z.uuid().optional(), expected: z.iso.datetime({ offset: true }).optional(), body: z.string().trim().min(1).max(4000), publish: z.boolean(), status: z.enum(["open", "in_progress", "waiting_for_follow_up", "resolved"]), key: z.uuid() }).parse(input);
    const actor = await getActor(); if (!actor) throw new Error("UNAUTHENTICATED");
    if (actor.role !== "admin" && (!p.publish || p.status !== "open")) throw new Error("FORBIDDEN");
    if (p.draft && (actor.role !== "admin" || !p.expected)) throw new Error("FORBIDDEN");
    const { error } = p.draft ? await actor.client.rpc("edit_inquiry_draft", { p_id: p.draft, p_body: p.body, p_publish: p.publish, p_status: p.status, p_expected: p.expected, p_key: p.key }) : await actor.client.rpc("reply_inquiry", { p_id: p.id, p_body: p.body, p_publish: p.publish, p_status: p.status, p_key: p.key });
    if (error) throw error;
    revalidatePath("/admin/inquiries"); revalidatePath("/patient/inquiries");
    return { ok: true, message: p.publish ? "Reply sent." : "Private draft saved. It is not visible to the patient." };
  } catch (error) { return { ok: false, message: error instanceof z.ZodError ? error.issues[0].message : safeError(error) }; }
}
