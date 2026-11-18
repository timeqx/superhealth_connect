"use server";

import { getActor } from "@/server/session";
import { isStaffRole } from "../domain/roles";

export async function getPatientDetails(patientId: string, page = 1) {
  const actor = await getActor();
  if (!actor || !isStaffRole(actor.role)) return { ok: false as const, message: "Staff access is required." };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(patientId) || !Number.isSafeInteger(page) || page < 1 || page > 10000)
    return { ok: false as const, message: "Invalid patient or history page." };

  try {
    const { data: profile, error: profileError } = await actor.client.from("profiles")
      .select("id,first_name,middle_name,last_name,phone,barangay_code,other_barangay,review_status,created_at")
      .eq("id", patientId).maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return { ok: false as const, message: "Patient details are unavailable." };
    const { data, error, count } = await actor.client.from("appointments")
      .select("id,public_reference,status,decision_reason,requested_at,service_slots!appointments_slot_id_fkey(starts_at,ends_at,services(name))", { count: "exact" })
      .eq("patient_id", patientId).order("requested_at", { ascending: false }).order("id")
      .range((page - 1) * 10, page * 10 - 1);
    if (error) throw error;
    const appointments = (data ?? []).map(row => {
      const slot = row.service_slots as unknown as { starts_at: string; ends_at: string; services: { name: string } | null } | null;
      return { id: row.id as string, reference: row.public_reference as string, status: row.status as string,
        reason: row.decision_reason as string | null, requestedAt: row.requested_at as string,
        service: slot?.services?.name ?? "Service unavailable", startsAt: slot?.starts_at, endsAt: slot?.ends_at };
    });
    return { ok: true as const, profile: {
      name: [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(" ") || "Patient",
      phone: profile.phone as string | null,
      barangay: (profile.barangay_code === "Others" ? profile.other_barangay : profile.barangay_code) as string | null,
      reviewStatus: profile.review_status as string, createdAt: profile.created_at as string,
    }, appointments, count: count ?? 0, page };
  } catch {
    return { ok: false as const, message: "Patient details could not be loaded. Please try again." };
  }
}
