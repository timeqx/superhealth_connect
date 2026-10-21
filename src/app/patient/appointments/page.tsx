import { requireActor } from "@/server/session";
import { Pagination, pageNumber } from "@/shared/ui/pagination";
import { Button } from "@/shared/ui/button";
import { ButtonLink, Card, PageTitle } from "@/shared/ui/components";
import { formatDate, formatTime } from "@/shared/lib/time";
import { AppointmentStatusBadge } from "@/shared/ui/care-components";
import { ManageVisit } from "@/features/appointments/presentation/manage-visit";
import { PatientQueue } from "@/features/queue/patient-queue";
export default async function Appointments({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
  const { client, user } = await requireActor();
  const params = await searchParams;
  const page = pageNumber(params.page);
  const states = ["pending", "scheduled", "checked_in", "in_service", "completed", "cancelled", "rejected", "no_show"];
  const status = states.includes(params.status ?? "") ? params.status! : "";
  let query = client
    .from("appointments")
    .select(
      "id,public_reference,status,updated_at,decision_reason,suggested:service_slots!appointments_suggested_slot_id_fkey(starts_at,services(name)),service_slots!appointments_slot_id_fkey(starts_at,services(name))",
      { count: "exact" },
    )
    .eq("patient_id", user.id)
    .order("created_at", { ascending: false }).order("id");
  if (status) query = query.eq("status", status);
  const { data, error, count } = await query.range((page - 1) * 20, page * 20 - 1);
  if (error) throw error;
  return (
    <>
      <PageTitle eyebrow="YOUR VISITS" title="Appointments">
        Requests remain pending until staff approves them. Queue tickets are
        issued at check-in.
      </PageTitle>
      <div className="visits-toolbar">
        <form className="visits-filter"><label>Visit status<select name="status" defaultValue={status}><option value="">All visits</option>{states.map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select></label><Button type="submit">Filter visits</Button></form>
        <ButtonLink href="/patient/book">Request an appointment</ButtonLink>
      </div>
      <div className="visit-list">
        {data.map((a) => {
          const slot = a.service_slots as unknown as {
            starts_at?: string;
            services?: { name?: string };
          } | null;
          return (
            <article className="visit-row" key={`${a.id}:${a.updated_at}`}>
              <div className="record-summary"><h2>{slot?.services?.name || "Your visit"}</h2><p>Reference {a.public_reference}</p></div>
              <div>{slot?.starts_at && <><strong>{formatDate(slot.starts_at)}</strong><p>{formatTime(slot.starts_at)} &middot; Philippine time</p></>}</div>
              <AppointmentStatusBadge status={a.status} />
              <div className="visit-actions">{["pending", "scheduled"].includes(a.status) && <ManageVisit id={a.id} expected={a.updated_at} asOf={new Date().toISOString()} />}</div>
              {a.decision_reason && <p className="notice visit-extra">{a.decision_reason}</p>}
            {a.suggested && <Card className="visit-extra"><h3>Staff suggested an alternative</h3><p>{new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(new Date((a.suggested as unknown as { starts_at: string }).starts_at))}</p><p>This is not reserved. Check availability and submit a new request.</p><ButtonLink href="/patient/book">View available sessions</ButtonLink></Card>}
            {["checked_in", "in_service"].includes(a.status) && <div className="visit-extra"><PatientQueue id={a.id} /></div>}
            </article>
          );
        })}
      </div>
      <Pagination page={page} count={count ?? 0} filters={{ status }} />
      {!data.length && (
        <Card>
          <h2>No matching appointments</h2>
          <p>
            Your submitted requests will appear here, along with updates from
            staff.
          </p>
        </Card>
      )}
    </>
  );
}
