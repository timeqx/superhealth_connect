import { requireActor } from "@/server/session";
import { PageTitle } from "@/shared/ui/components";
import { RequestTable, type StaffRequest } from "@/shared/ui/admin-request-panel";
export default async function Admin() {
  const { client } = await requireActor(true);
  const { data, error } = await client
    .from("appointments")
    .select("id,public_reference,status,updated_at,profiles!appointments_patient_id_fkey(first_name,last_name),service_slots!appointments_slot_id_fkey(starts_at,ends_at,services(name))")
    .eq("status", "pending")
    .order("created_at")
    .limit(50);
  if (error) throw error;
  const requests: StaffRequest[] = data.map(row => {
    const profile = row.profiles as unknown as { first_name: string; last_name: string } | null;
    const slot = row.service_slots as unknown as { starts_at: string; ends_at: string; services: { name: string } | null } | null;
    return { id: row.id, public_reference: row.public_reference, status: row.status, updated_at: row.updated_at,
      patientName: profile ? `${profile.first_name} ${profile.last_name}` : "Patient details unavailable",
      serviceName: slot?.services?.name, startsAt: slot?.starts_at, endsAt: slot?.ends_at };
  });
  return (
    <>
      <PageTitle eyebrow="STAFF WORKSPACE" title="Appointment requests">
        Authorized staff view · Oldest pending requests first
      </PageTitle>
      <RequestTable requests={requests} live />
      <p className="caption">
        Showing up to 50 oldest pending requests. Approval confirms the session;
        queue tickets are issued separately at staff check-in.
      </p>
    </>
  );
}
