import { WorkspaceTabs } from "@/shared/ui/workspace-tabs";
import { ServiceDefinition } from "@/features/operations/service-definition";
import Link from "next/link";
import { requireActor } from "@/server/session";
import { Card, PageTitle } from "@/shared/ui/components";
import { OperationsForm } from "@/features/operations/forms";
import { formatDate, formatTime } from "@/shared/lib/time";
export default async function Schedules({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { client } = await requireActor(true);
  const params = await searchParams;
  const page = Math.min(10000, Math.max(1, Number(params.page) || 1)) | 0;
  const [services, slots] = await Promise.all([
    client.from("services").select("id,name,slug,description,updated_at,requirements,arrival_minutes,is_published,is_bookable").order("name"),
    client.from("service_slots").select("id,service_id,starts_at,ends_at,capacity,is_open,updated_at", { count: "exact" }).gte("ends_at", new Date().toISOString()).order("starts_at").order("id").range((page - 1) * 20, page * 20 - 1),
  ]);
  if (services.error || slots.error) throw new Error("Schedules could not be loaded.");
  return <>
    <PageTitle eyebrow="STAFF WORKSPACE" title="Services & schedules">Publish approved services and manage session capacity. All times are Asia/Manila.</PageTitle>
    <WorkspaceTabs tabs={[
      { id: "sessions", label: "Sessions", content: <div className="staff-split">
        <Card><h2>Create a session</h2><OperationsForm services={services.data} /></Card>
        <section className="stack"><h2>Upcoming sessions</h2>
          {slots.data.map(s => <Card key={s.id}><div className="row"><h3>{services.data.find(v => v.id === s.service_id)?.name}</h3><p>{formatDate(s.starts_at)} &middot; {formatTime(s.starts_at)}–{formatTime(s.ends_at)}</p></div><p className="caption">Existing times stay fixed. Closing a session stops new requests; existing visits remain reserved.</p><OperationsForm slot={s} /></Card>)}
          {!slots.data.length && <p>No upcoming sessions.</p>}
          <nav aria-label="Session pages">{page > 1 && <Link href={`?page=${page - 1}`}>Previous &middot; </Link>}Page {page}{page * 20 < (slots.count ?? 0) && <Link href={`?page=${page + 1}`}> &middot; Next</Link>}</nav>
        </section>
      </div> },
      { id: "services", label: "Services", content: <div className="stack">
        <Card><h2>Add a service</h2><ServiceDefinition /></Card>
        <h2>Service settings</h2>
        {services.data.map(s => <Card key={s.id}><h3>{s.name}</h3><div className="service-edit-layout"><ServiceDefinition key={s.updated_at} service={s} /><OperationsForm service={s} /></div></Card>)}
      </div> },
    ]} />
  </>;
}
