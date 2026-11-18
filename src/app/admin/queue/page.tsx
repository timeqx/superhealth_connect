import { CancelApprovedAppointment } from "@/features/appointments/presentation/cancel-approved-appointment";
import { QueueDateFilter } from "@/features/queue/queue-date-filter";
import { validDateOnly } from "@/shared/lib/date-field";
import { sessionDateRange } from "@/features/operations/session-summary";
import { PatientDetailsDialog } from "@/features/accounts/presentation/patient-details-dialog";
import { requireStaffActor } from "@/server/session";
import { Card, PageTitle } from "@/shared/ui/components";
import { AppointmentStatusBadge } from "@/shared/ui/care-components";
import { QueueAction } from "@/features/queue/queue-action";
import { manilaDate, formatTime } from "@/shared/lib/time";
export default async function StaffQueue({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { client } = await requireStaffActor();
  const today = manilaDate(new Date());
  const params = await searchParams;
  const date = params.date && validDateOnly(params.date) ? params.date : today;
  const bounds = sessionDateRange(date);
  const isToday = date === today;
  const [visits, sessions] = await Promise.all([
    client.from("appointments").select("id,updated_at,patient_id,profiles!appointments_patient_id_fkey(first_name,last_name),public_reference,status,service_slots!appointments_slot_id_fkey!inner(starts_at,ends_at,services(name))").eq("status", "scheduled").gte("service_slots.starts_at", bounds.start).lt("service_slots.starts_at", bounds.end).order("created_at"),
    client.from("queue_sessions").select("id,status,services(name),queue_tickets(id,ticket_number,status,order_sequence,appointments!queue_tickets_appointment_id_fkey(patient_id,profiles!appointments_patient_id_fkey(first_name,last_name)))").eq("service_date", date).order("created_at"),
  ]);
  if (visits.error || sessions.error) throw new Error("The selected queue could not be loaded. Refresh to try again.");
  return <><PageTitle eyebrow="STAFF OPERATIONS" title="Arrivals & queue">{`${date} \u00b7 Philippine time. ${isToday ? "Confirm arrival before issuing a ticket." : "Viewing another day. Check-in and live queue controls are available today only."}`}</PageTitle>
    <QueueDateFilter date={date} today={today} />
    <div className="queue-layout"><section className="stack"><h2>Scheduled arrivals</h2><div className="arrival-list">{visits.data.map(v => {
      const slot = v.service_slots as unknown as { starts_at: string; services: { name: string } | null };
      const person = v.profiles as unknown as { first_name: string; last_name: string } | null;
      return <Card key={v.id}><PatientDetailsDialog patientId={v.patient_id} name={person ? `${person.first_name} ${person.last_name}` : "Patient"} asName /><h3>{v.public_reference}</h3><p>{slot.services?.name} · {formatTime(slot.starts_at)}</p><div className="actions">{isToday && <QueueAction id={v.id} action="check_in" label="Check in patient" />}<CancelApprovedAppointment key={`${v.id}:${v.updated_at}`} id={v.id} expected={v.updated_at} reference={v.public_reference} /></div></Card>;
    })}</div>{!visits.data.length && <p>No scheduled arrivals awaiting check-in for this date.</p>}
    </section><section className="stack"><h2>Service queues</h2>{sessions.data.map(q => {
      const service = q.services as unknown as { name: string } | null;
      const tickets = [...q.queue_tickets].sort((a,b) => a.order_sequence-b.order_sequence);
      const active = tickets.some(t => ["called", "serving"].includes(t.status));
      const unresolved = tickets.some(t => ["waiting", "called", "serving", "skipped"].includes(t.status));
      return <Card key={q.id}><div className="row"><h2>{service?.name || "Service queue"}</h2><AppointmentStatusBadge status={q.status} /></div>
        {isToday && q.status === "open" && <div className="actions"><QueueAction key={`${q.id}:${tickets.map(t => `${t.id}-${t.status}`).join()}`} id={q.id} action="call_next" label="Call next" disabled={active || !tickets.some(t => t.status === "waiting")} /><QueueAction id={q.id} action="close" label="Close queue" disabled={unresolved} /></div>}
        {tickets.map(t => {
          const visit = t.appointments as unknown as { patient_id: string; profiles: { first_name: string; last_name: string } | null } | null;
          return <div className="row" key={`${t.id}:${t.status}`}><strong>Q-{String(t.ticket_number).padStart(3,"0")}</strong>{visit && <PatientDetailsDialog patientId={visit.patient_id} name={visit.profiles ? `${visit.profiles.first_name} ${visit.profiles.last_name}` : "Patient"} asName />}<AppointmentStatusBadge status={t.status} />{isToday && q.status === "open" && <div className="actions">{t.status === "called" && <><QueueAction id={q.id} ticket={t.id} action="start" label="Start service" /><QueueAction id={q.id} ticket={t.id} action="skip" label="Skip ticket" /></>}{t.status === "serving" && <QueueAction id={q.id} ticket={t.id} action="complete" label="Complete visit" />}{t.status === "skipped" && <QueueAction id={q.id} ticket={t.id} action="requeue" label="Return to queue" />}</div>}</div>; })}
      </Card>;
    })}{!sessions.data.length && <p>No service queues for this date. Queues appear after the first staff check-in.</p>}</section></div></>;
}
