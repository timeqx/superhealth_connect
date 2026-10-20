"use server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getActor } from "@/server/session";
import { uploadClient } from "@/shared/supabase/privileged";
import { safeError, type ActionResult } from "@/shared/lib/errors";
import { submitVerification } from "./verification";

export async function uploadVerification(
  form: FormData,
): Promise<ActionResult> {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    const file = form.get("document");
    const key = z.uuid().parse(form.get("key"));
    if (!(file instanceof File) || file.size === 0 || file.size > 5242880)
      return {
        ok: false,
        message: "Choose a JPEG, PNG or PDF no larger than 5 MB.",
      };
    const bytes = new Uint8Array(await file.arrayBuffer());
    // Stable across network retries; scoped to actor and actual bytes. Changed
    // files can never overwrite an earlier submission under the same browser key.
    const digest = createHash("sha256")
      .update(actor.user.id)
      .update(key)
      .update(bytes)
      .digest("hex");
    const id = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
    await submitVerification(
      {
        async findSubmission(documentId) {
          const { data, error } = await actor.client
            .from("verification_documents")
            .select("id,storage_path,mime_type,size_bytes")
            .eq("id", documentId)
            .eq("user_id", actor.user.id)
            .maybeSingle();
          if (error) throw error;
          return data
            ? {
                id: data.id,
                path: data.storage_path,
                mime: data.mime_type,
                size: data.size_bytes,
              }
            : null;
        },
        async store(path, body, mime) {
          const client = uploadClient();
          const { error } = await client.storage
            .from("verification")
            .upload(path, body, {
              contentType: mime,
              upsert: false,
              cacheControl: "0",
            });
          if (error) {
            // Storage may have committed before the client lost the response.
            const { data: existing, error: readError } = await client.storage
              .from("verification")
              .download(path);
            if (readError || !existing) throw new Error("UPLOAD_FAILED");
            const existingHash = createHash("sha256")
              .update(new Uint8Array(await existing.arrayBuffer()))
              .digest("hex");
            if (
              existingHash !== createHash("sha256").update(body).digest("hex")
            )
              throw new Error("CONFLICT");
          }
        },
        async submit(document) {
          const { error } = await uploadClient().rpc("submit_verification", {
            p_user: actor.user.id,
            p_document: document.id,
            p_path: document.path,
            p_mime: document.mime,
            p_size: document.size,
          });
          if (error) {
            // Reconcile concurrent retries or an uncertain committed response.
            const { data: committed, error: readError } = await actor.client
              .from("verification_documents")
              .select("id")
              .eq("id", document.id)
              .eq("user_id", actor.user.id)
              .eq("storage_path", document.path)
              .maybeSingle();
            if (readError || !committed) throw error;
          }
        },
      },
      {
        id: actor.user.id,
        role: actor.role,
        verified: Boolean(actor.user.email_confirmed_at),
        profile: actor.profile,
      },
      { id, name: file.name, type: file.type, bytes },
    );
    revalidatePath("/patient/profile");
    revalidatePath("/admin/reviews");
    return {
      ok: true,
      message:
        "Verification received. Your latest account status is shown below.",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "PROFILE_INCOMPLETE")
      return {
        ok: false,
        message:
          "Save your name, barangay, and mobile number before submitting verification.",
      };
    if (message === "UPLOAD_NOT_CONFIGURED")
      return {
        ok: false,
        message:
          "Private uploads are temporarily unavailable. Please contact staff or try again later.",
      };
    if (message === "UPLOAD_FAILED")
      return {
        ok: false,
        message:
          "The private upload could not be saved. Keep this file selected and try again.",
      };
    if (message.startsWith("Choose a JPEG") || message.startsWith("Use a file"))
      return { ok: false, message };
    return { ok: false, message: safeError(error) };
  }
}
export async function reviewAccount(input: unknown): Promise<ActionResult> {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    if (actor.role !== "admin") throw new Error("FORBIDDEN");
    const p = z
      .object({
        user: z.uuid(),
        document: z.uuid(),
        decision: z.enum(["approved", "rejected"]),
        reason: z.string().trim().max(1000),
        key: z.uuid(),
      })
      .refine((v) => v.decision !== "rejected" || v.reason.length > 0, {
        message: "Enter a reason so the patient knows what to correct.",
      })
      .parse(input);
    const { error } = await actor.client.rpc("review_account", {
      p_user: p.user,
      p_document: p.document,
      p_decision: p.decision,
      p_reason: p.reason,
      p_key: p.key,
    });
    if (error) throw error;
    revalidatePath("/admin/reviews");
    return {
      ok: true,
      message:
        p.decision === "approved"
          ? "Account approved. The patient can now request appointments."
          : "Account rejected with correction instructions.",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof z.ZodError
          ? error.issues[0].message
          : safeError(error),
    };
  }
}
