import { requireActor } from "@/server/session";
import { Card, PageTitle } from "@/shared/ui/components";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { manilaDate } from "@/shared/lib/time";
const states = ["pending", "scheduled", "checked_in", "in_service", "completed", "cancelled", "rejected", "no_show"];
export default async function Reports({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { client } = await requireActor(true);
  const params = await searchParams;
  const today = manilaDate(new Date());
  const validDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().startsWith(s);
  const from = validDate(params.from) ? params.from! : today;
  const to = validDate(params.to) ? params.to! : today;
  const start = new Date(`${from}T00:00:00+08:00`);
  const end = new Date(new Date(`${to}T00:00:00+08:00`).getTime() + 86400000);
  const validRange = end > start && end.getTime() - start.getTime() <= 93 * 86400000;
  const counts = validRange ? await Promise.all(states.map(status => client.from("appointments").select("id", { count: "exact", head: true }).eq("status", status).gte("requested_at", start.toISOString()).lt("requested_at", end.toISOString()))) : [];
  if (counts.some(r => r.error)) throw new Error("Reports could not be loaded.");
  const total = counts.reduce((n, r) => n + (r.count ?? 0), 0);
  const audit = await client.from("audit_logs").select("id,action,entity_type,created_at").order("created_at", { ascending: false }).limit(30);
  if (audit.error) throw new Error("Audit activity could not be loaded.");
  return <><PageTitle eyebrow="STAFF WORKSPACE" title="Operational reports">Current outcomes for requests submitted within the selected Manila dates.</PageTitle><Card><form className="stack"><label>From<Input type="date" name="from" defaultValue={from} required /></label><label>Through<Input type="date" name="to" defaultValue={to} required /></label><Button type="submit">Update report</Button></form></Card>{!validRange ? <p role="alert">Choose an ordered date range of up to 93 days.</p> : <Card><h2>{total} requests</h2><p>Denominator: all requests created in this period, including pending and cancelled requests. Outcomes reflect their current status, not the date they occurred.</p><dl>{states.map((status, i) => <div key={status} className="inquiry-message"><dt>{status.replaceAll("_", " ")}</dt><dd>{counts[i].count ?? 0} · {total ? (((counts[i].count ?? 0) / total) * 100).toFixed(1) : "0"}%</dd></div>)}</dl><p className="caption">No patient identifiers are included. These counts do not measure wait times or service duration.</p></Card>}<Card><h2>Latest staff activity</h2><p>Latest 30 actions, independent of report dates. Detailed record contents are excluded.</p>{audit.data.map(a => <p key={a.id}>{new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(new Date(a.created_at))} · {a.action.replaceAll("_", " ")} · {a.entity_type}</p>)}</Card></>;
}
