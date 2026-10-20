import { requireActor } from "@/server/session";
import { Badge, Card, PageTitle } from "@/shared/ui/components";
export default async function Admin() {
  const { client } = await requireActor(true);
  const { data, error } = await client
    .from("appointments")
    .select("id,public_reference,status")
    .eq("status", "pending")
    .order("created_at")
    .limit(50);
  if (error) throw error;
  return (
    <>
      <PageTitle eyebrow="STAFF WORKSPACE" title="Appointment requests">
        Authorized staff view · Oldest pending requests first
      </PageTitle>
      <Card>
        <h2>Pending requests</h2>
        {data.map((a) => (
          <div className="row" key={a.id}>
            <strong>{a.public_reference}</strong>
            <Badge>{a.status}</Badge>
          </div>
        ))}
        {!data.length && <p>No requests awaiting review.</p>}
      </Card>
      <p className="notice">
        Appointment decision, scheduling, and queue controls are still being
        implemented. This page currently provides an authorized read-only
        request list.
      </p>
    </>
  );
}
