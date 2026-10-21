import { requireActor } from "@/server/session";
import Link from "next/link";
import { PageTitle } from "@/shared/ui/components";
import { RequestTable, type StaffRequest } from "@/shared/ui/admin-request-panel";
async function reviewDeadlineCount(hours: number) {
  const { client } = await requireActor(true);
  const cutoff = new Date(Date.now() - hours * 3600000).toISOString();
  return client.from("appointments").select("id", { count: "exact", head: true }).eq("status", "pending").lt("requested_at", cutoff);
}
export default async function Admin({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { client } = await requireActor(true);
  const params = await searchParams;
  const page = Math.min(10000, Math.max(1, Number(params.page) || 1)) | 0;
  const hours = Number(process.env.APPOINTMENT_REVIEW_HOURS);
  const overdue = Number.isFinite(hours) && hours > 0 ? await reviewDeadlineCount(hours) : null;
  if (overdue?.error) throw new Error("Review deadlines could not be loaded.");
  const { data, error, count } = await client
    .from("appointments")
    .select("id,public_reference,status,updated_at,profiles!appointments_patient_id_fkey(first_name,last_name),service_slots!appointments_slot_id_fkey(starts_at,ends_at,services(name))", { count: "exact" })
    .eq("status", "pending")
    .order("created_at")
    .order("id")
    .range((page - 1) * 25, page * 25 - 1);
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
      <p className="notice">{overdue ? `${overdue.count ?? 0} pending requests exceed the configured ${hours}-hour review deadline.` : "Review deadline is not configured. Requests remain pending until staff decides."}</p>
      <nav aria-label="Request pages">{page > 1 && <Link href={`?page=${page - 1}`}>Previous · </Link>}Page {page}{page * 25 < (count ?? 0) && <Link href={`?page=${page + 1}`}> · Next</Link>}</nav>
      <p className="caption">
        Showing 25 requests per page, oldest first. Approval confirms the session;
        queue tickets are issued separately at staff check-in.
      </p>
    </>
  );
}
