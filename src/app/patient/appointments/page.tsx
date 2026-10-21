import { requireActor } from "@/server/session";
import { ButtonLink, Card, PageTitle } from "@/shared/ui/components";
import { AppointmentCard } from "@/shared/ui/care-components";
import { ManageVisit } from "@/features/appointments/presentation/manage-visit";
import { PatientQueue } from "@/features/queue/patient-queue";
export default async function Appointments() {
  const { client, user } = await requireActor();
  const { data, error } = await client
    .from("appointments")
    .select(
      "id,public_reference,status,updated_at,decision_reason,service_slots!appointments_slot_id_fkey(starts_at,services(name))",
    )
    .eq("patient_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (
    <>
      <PageTitle eyebrow="YOUR VISITS" title="Appointments">
        Requests remain pending until staff approves them. Queue tickets are
        issued at check-in.
      </PageTitle>
      <div>
        <ButtonLink href="/patient/book">Request an appointment</ButtonLink>
      </div>
      <div className="appointment-grid">
        {data.map((a) => {
          const slot = a.service_slots as unknown as {
            starts_at?: string;
            services?: { name?: string };
          } | null;
          return (
            <div className="stack" key={`${a.id}:${a.updated_at}`}><AppointmentCard
              reference={a.public_reference}
              service={slot?.services?.name || "Your visit"}
              startsAt={slot?.starts_at}
              status={a.status}
              reason={a.decision_reason}
            />
            {["pending", "scheduled"].includes(a.status) && <ManageVisit id={a.id} expected={a.updated_at} asOf={new Date().toISOString()} />}
            {["checked_in", "in_service"].includes(a.status) && <PatientQueue id={a.id} />}
            </div>
          );
        })}
      </div>
      {!data.length && (
        <Card>
          <h2>No appointments yet</h2>
          <p>
            Your submitted requests will appear here, along with updates from
            staff.
          </p>
        </Card>
      )}
    </>
  );
}
