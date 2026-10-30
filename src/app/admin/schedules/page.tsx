import { WorkspaceTabs } from "@/shared/ui/workspace-tabs";
import { ServiceDefinition } from "@/features/operations/service-definition";
import { ServiceScheduleForm } from "@/features/operations/service-schedule";
import Link from "next/link";
import { requireActor } from "@/server/session";
import { Card, PageTitle } from "@/shared/ui/components";
import { OperationsForm } from "@/features/operations/forms";
import { formatDate, formatTime } from "@/shared/lib/time";
export default async function Schedules({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { client } = await requireActor(true);
  const { error: scheduleError } = await client.rpc("ensure_service_sessions", { p_service: null });
  if (scheduleError) throw new Error("Regular service sessions could not be prepared.");
  const params = await searchParams;
  const page = Math.min(10000, Math.max(1, Number(params.page) || 1)) | 0;
  const [services, slots] = await Promise.all([
    client.from("services").select("id,name,slug,description,updated_at,requirements,arrival_minutes,is_published,is_bookable,opening_time,closing_time,daily_capacity,weekdays").order("name"),
    client.from("service_slots").select("id,service_id,starts_at,ends_at,capacity,is_open,updated_at", { count: "exact" }).gte("ends_at", new Date().toISOString()).order("starts_at").order("id").range((page - 1) * 20, page * 20 - 1),
  ]);
  if (services.error || slots.error) throw new Error("Schedules could not be loaded.");
  return <>
    <PageTitle eyebrow="STAFF WORKSPACE" title="Services & schedules">Publish approved services and manage session capacity. All times are Asia/Manila.</PageTitle>
    <WorkspaceTabs tabs={[
      { id: "sessions", label: "Sessions", content: <div className="staff-split">
        <Card><h2>Create a session</h2><OperationsForm services={services.data} /></Card>
        <section className="stack"><h2>Upcoming sessions</h2>
          {slots.data.map(s => <Card key={s.id}><div className="row"><h3>{services.data.find(v => v.id === s.service_id)?.name}</h3><p>{formatDate(s.starts_at)} &middot; {formatTime(s.starts_at)}–{formatTime(s.ends_at)}</p></div><p className="caption">Edit hours for dates without appointments. Closing a session stops new requests; existing visits remain reserved. Date-specific changes override the regular schedule.</p><OperationsForm key={s.updated_at} slot={s} /></Card>)}
          {!slots.data.length && <p>No upcoming sessions.</p>}
          <nav aria-label="Session pages">{page > 1 && <Link href={`?page=${page - 1}`}>Previous &middot; </Link>}Page {page}{page * 20 < (slots.count ?? 0) && <Link href={`?page=${page + 1}`}> &middot; Next</Link>}</nav>
        </section>
      </div> },
      { id: "services", label: "Services", content: <WorkspaceTabs sidebar label="Choose a service" tabs={[
        ...services.data.map(s => ({ id: s.id, label: s.name, content: <Card><h2>{s.name}</h2><div className="service-edit-layout"><section className="stack"><h3>Service details</h3><ServiceDefinition key={s.updated_at} service={s} /><ServiceScheduleForm key={`schedule-${s.updated_at}`} service={s} /></section><section className="stack"><h3>Availability & requirements</h3><OperationsForm key={s.updated_at} service={s} /></section></div></Card> })),
        { id: "add-service", label: "+ Add a service", content: <Card className="form-panel"><h2>Add a service</h2><ServiceDefinition /></Card> },
      ]} /> },
    ]} />
  </>;
}
