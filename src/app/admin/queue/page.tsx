import { requireActor } from "@/server/session";
import { Card, PageTitle } from "@/shared/ui/components";
import { AppointmentStatusBadge } from "@/shared/ui/care-components";
import { QueueAction } from "@/features/queue/queue-action";
import { manilaDate, formatTime } from "@/shared/lib/time";
export default async function StaffQueue() {
  const { client } = await requireActor(true);
  const today = manilaDate(new Date());
  const [visits, sessions] = await Promise.all([
    client.from("appointments").select("id,public_reference,status,service_slots!appointments_slot_id_fkey!inner(starts_at,ends_at,services(name))").eq("status", "scheduled").gte("service_slots.starts_at", `${today}T00:00:00+08:00`).lte("service_slots.starts_at", `${today}T23:59:59.999+08:00`).order("created_at"),
    client.from("queue_sessions").select("id,status,services(name),queue_tickets(id,ticket_number,status,order_sequence)").eq("service_date", today).order("created_at"),
  ]);
  if (visits.error || sessions.error) throw new Error("Today's queue could not be loaded. Refresh to try again.");
  return <><PageTitle eyebrow="STAFF OPERATIONS" title="Arrivals & queue">{`${today} · Philippine time. Confirm arrival before issuing a ticket.`}</PageTitle>
    <h2>Scheduled arrivals</h2><div className="grid-three">{visits.data.map(v => {
      const slot = v.service_slots as unknown as { starts_at: string; services: { name: string } | null };
      return <Card key={v.id}><h3>{v.public_reference}</h3><p>{slot.services?.name} · {formatTime(slot.starts_at)}</p><QueueAction id={v.id} action="check_in" label="Check in patient" /></Card>;
    })}</div>{!visits.data.length && <p>No scheduled arrivals awaiting check-in today.</p>}
    <h2>Service queues</h2>{sessions.data.map(q => {
      const service = q.services as unknown as { name: string } | null;
      const tickets = [...q.queue_tickets].sort((a,b) => a.order_sequence-b.order_sequence);
      const active = tickets.some(t => ["called", "serving"].includes(t.status));
      const unresolved = tickets.some(t => ["waiting", "called", "serving", "skipped"].includes(t.status));
      return <Card key={q.id}><div className="row"><h2>{service?.name || "Service queue"}</h2><AppointmentStatusBadge status={q.status} /></div>
        {q.status === "open" && <div className="actions"><QueueAction key={`${q.id}:${tickets.map(t => `${t.id}-${t.status}`).join()}`} id={q.id} action="call_next" label="Call next" disabled={active || !tickets.some(t => t.status === "waiting")} /><QueueAction id={q.id} action="close" label="Close queue" disabled={unresolved} /></div>}
        {tickets.map(t => <div className="row" key={`${t.id}:${t.status}`}><strong>Q-{String(t.ticket_number).padStart(3,"0")}</strong><AppointmentStatusBadge status={t.status} />{q.status === "open" && <div className="actions">{t.status === "called" && <><QueueAction id={q.id} ticket={t.id} action="start" label="Start service" /><QueueAction id={q.id} ticket={t.id} action="skip" label="Skip ticket" /></>}{t.status === "serving" && <QueueAction id={q.id} ticket={t.id} action="complete" label="Complete visit" />}{t.status === "skipped" && <QueueAction id={q.id} ticket={t.id} action="requeue" label="Return to queue" />}</div>}</div>)}
      </Card>;
    })}{!sessions.data.length && <p>Queues appear after the first staff check-in.</p>}</>;
}
