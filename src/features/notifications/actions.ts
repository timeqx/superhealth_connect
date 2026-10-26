"use server";
import { z } from "zod";
import { getActor } from "@/server/session";
import { revalidatePath } from "next/cache";
import { safeError } from "@/shared/lib/errors";
export async function readNotification(id: string) {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    const { error } = await actor.client.rpc("mark_notification_read", { p_id: z.uuid().parse(id) });
    if (error) throw error;
    revalidatePath("/patient/notifications");
    return { ok: true, message: "Marked as read." };
  } catch (error) { return { ok: false, message: safeError(error) }; }
}
