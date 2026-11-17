import { WorkspaceTabs } from "@/shared/ui/workspace-tabs";
import { ServiceDefinition } from "@/features/operations/service-definition";
import { ServiceEditor } from "@/features/operations/service-editor";
import { SessionDateFilter } from "@/features/operations/session-date-filter";
import { Pagination, pageNumber } from "@/shared/ui/pagination";
import { groupServiceSessions, loadUpcomingSessions, sessionDateRange } from "@/features/operations/session-summary";
import { requireActor } from "@/server/session";
import { Card, PageTitle } from "@/shared/ui/components";
import { OperationsForm } from "@/features/operations/forms";
import { formatDate, formatTime, manilaDate } from "@/shared/lib/time";
export default async function Schedules({ searchParams }: { searchParams: Promise<{ page?: string; date?: string }> }) {
  const { client } = await requireActor(true);
  const { error: scheduleError } = await client.rpc("ensure_service_sessions", { p_service: null });
  if (scheduleError) throw new Error("Regular service sessions could not be prepared.");
  const params = await searchParams;
  const asOf = new Date().toISOString();
  let date = params.date ?? "";
  let invalidDate = false;
  if (date) {
    try { sessionDateRange(date); } catch { date = ""; invalidDate = true; }
  }
  const [services, slots] = await Promise.all([
    client.from("services").select("id,name,slug,description,updated_at,requirements,arrival_minutes,is_published,is_bookable,opening_time,closing_time,slot_duration_minutes,slot_capacity,weekdays").order("name"),
    loadUpcomingSessions(client, asOf, date || undefined),
  ]);
  if (services.error) throw new Error("Schedules could not be loaded.");
  // Group before paginating so a day's sessions never split across cards/pages.
  const groups = groupServiceSessions(slots);
  const page = Math.min(pageNumber(params.page), Math.max(1, Math.ceil(groups.length / 20)));
  const visibleGroups = groups.slice((page - 1) * 20, page * 20);
  return <>
    <PageTitle eyebrow="STAFF WORKSPACE" title="Services & schedules">Publish approved services and manage session capacity. All times are Asia/Manila.</PageTitle>
    <WorkspaceTabs tabs={[
      { id: "sessions", label: "Sessions", content: <div className="staff-split">
        <Card><h2>Create a session</h2><OperationsForm services={services.data} /></Card>
        <section className="stack"><h2>Upcoming sessions</h2>
          <SessionDateFilter date={date} today={manilaDate(asOf)} />
          {invalidDate && <p className="notice" role="status">Choose a valid session date. Showing all upcoming dates.</p>}
          <p className="caption">One summary per service and day. Expand a summary to manage individual sessions.</p>
          {visibleGroups.map(group => <Card key={group.key} className="session-day-summary">
            <div className="row"><h3>{services.data.find(v => v.id === group.serviceId)?.name ?? "Service"}</h3><p>{formatDate(group.startsAt)}</p></div>
            <p>{group.sessions.length} {group.sessions.length === 1 ? "session" : "sessions"} · {formatTime(group.startsAt)}–{formatTime(group.endsAt)}</p>
            <p><strong>{group.capacity} patient slots</strong> total configured capacity · {group.openCount} open / {group.sessions.length - group.openCount} closed sessions</p>
            <details>
              <summary>View and edit {group.sessions.length} {group.sessions.length === 1 ? "session" : "sessions"}</summary>
              <div className="stack">
                <p className="caption">Capacity is the configured limit, not remaining availability. Closing an individual session stops new requests; existing visits remain reserved.</p>
                {group.sessions.map(s => <details key={s.id}>
                  <summary>{formatTime(s.starts_at)}–{formatTime(s.ends_at)} · {s.capacity} patient slots · {s.is_open ? "Open" : "Closed"}</summary>
                  <OperationsForm key={s.updated_at} slot={s} />
                </details>)}
              </div>
            </details>
          </Card>)}
          {!groups.length && <p>{date ? "No upcoming sessions on this date. Choose another date or clear the filter." : "No upcoming sessions."}</p>}
          <Pagination page={page} count={groups.length} filters={date ? { date } : {}} />
        </section>
      </div> },
      { id: "services", label: "Services", content: <WorkspaceTabs sidebar label="Choose a service" tabs={[
        ...services.data.map(s => ({ id: s.id, label: s.name, content: <Card><h2>{s.name}</h2><ServiceEditor service={s} /></Card> })),
        { id: "add-service", label: "+ Add a service", content: <Card className="form-panel"><h2>Add a service</h2><ServiceDefinition /></Card> },
      ]} /> },
    ]} />
  </>;
}
