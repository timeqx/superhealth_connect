import { requireActor } from "@/server/session";
import { Badge, ButtonLink, Card, PageTitle } from "@/shared/ui/components";
import { formatDate, formatTime } from "@/shared/lib/time";
export default async function Appointments() {
  const { client, user } = await requireActor();
  const { data, error } = await client
    .from("appointments")
    .select(
      "id,public_reference,status,decision_reason,service_slots(starts_at,services(name))",
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
      <ButtonLink href="/patient/book">Request an appointment</ButtonLink>
      <div className="grid-three">
        {data.map((a) => (
          <Card key={a.id}>
            <Badge>{a.status.replaceAll("_", " ").toUpperCase()}</Badge>
            <h2>{a.public_reference}</h2>
            <AppointmentDetails value={a.service_slots} />
            {a.decision_reason && <p>{a.decision_reason}</p>}
          </Card>
        ))}
      </div>
      {!data.length && (
        <Card>
          <h2>No appointments yet</h2>
          <p>Your submitted requests will appear here.</p>
        </Card>
      )}
    </>
  );
}
function AppointmentDetails({ value }: { value: unknown }) {
  const slot = value as {
    starts_at?: string;
    services?: { name?: string };
  } | null;
  return (
    <>
      {slot?.services?.name && <h3>{slot.services.name}</h3>}
      {slot?.starts_at && (
        <p>
          {formatDate(slot.starts_at)} · {formatTime(slot.starts_at)}
        </p>
      )}
    </>
  );
}
