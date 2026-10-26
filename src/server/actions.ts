"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActor } from "./session";
import { profileSchema } from "@/features/accounts/domain/validation";
import { safeError, type ActionResult } from "@/shared/lib/errors";
import { requestAppointment } from "@/features/appointments/application/request-appointment";
import { appointmentRepository } from "@/features/appointments/infrastructure/supabase-repository";
export async function saveProfile(input: unknown): Promise<ActionResult> {
  try {
    const { client } = await requireActor();
    const p = profileSchema.parse(input);
    const { error } = await client.rpc("save_profile", {
      p_first: p.first,
      p_middle: p.middle,
      p_last: p.last,
      p_barangay: p.barangay,
      p_other: p.other,
      p_phone: p.phone,
    });
    if (error) throw error;
    revalidatePath("/patient");
    return {
      ok: true,
      message:
        "Profile saved. You can now submit your verification document for staff review.",
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
export async function book(input: unknown): Promise<ActionResult> {
  try {
    const { client } = await requireActor();
    const result = await requestAppointment(
      appointmentRepository(client),
      input,
    );
    revalidatePath("/patient/appointments");
    return {
      ok: true,
      message: `Request ${result.public_reference} received. Pending staff approval.`,
      redirectTo: "/patient/appointments",
    };
  } catch (error) {
    return { ok: false, message: safeError(error) };
  }
}
export async function cancelAppointment(input: unknown): Promise<ActionResult> {
  try {
    const p = z
      .object({
        id: z.uuid(),
        key: z.uuid(),
        expected: z.string(),
        reason: z.string().trim().min(1).max(1000),
      })
      .parse(input);
    const { client } = await requireActor();
    const { error } = await client.rpc("change_appointment", {
      p_id: p.id,
      p_action: "cancel",
      p_key: p.key,
      p_expected: p.expected,
      p_reason: p.reason,
    });
    if (error) throw error;
    revalidatePath("/patient/appointments");
    return { ok: true, message: "Appointment cancelled." };
  } catch (error) {
    return { ok: false, message: safeError(error) };
  }
}
export async function sendInquiry(input: unknown): Promise<ActionResult> {
  try {
    const p = z
      .object({
        subject: z.string().trim().min(3).max(120),
        category: z.enum(["Appointments", "Account", "Services", "General"]),
        body: z.string().trim().min(1).max(4000),
        key: z.uuid(),
      })
      .parse(input);
    const { client } = await requireActor();
    const { error } = await client.rpc("create_inquiry", {
      p_subject: p.subject,
      p_category: p.category,
      p_body: p.body,
      p_key: p.key,
    });
    if (error) throw error;
    revalidatePath("/patient/inquiries");
    return {
      ok: true,
      message:
        "Your inquiry was received. Replies will appear in your account.",
    };
  } catch (error) {
    return { ok: false, message: safeError(error) };
  }
}
