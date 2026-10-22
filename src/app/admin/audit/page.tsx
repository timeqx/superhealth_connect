import Form from "next/form";
import { requireActor } from "@/server/session";
import { PageTitle, Card } from "@/shared/ui/components";
import { Pagination, pageNumber } from "@/shared/ui/pagination";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
export default async function Audit({ searchParams }: { searchParams: Promise<{ page?: string; action?: string }> }) {
  const { client } = await requireActor(true);
  const params = await searchParams;
  const page = pageNumber(params.page);
  const action = (params.action ?? "").trim().slice(0, 100);
  let query = client.from("audit_logs").select("id,action,entity_type,created_at", { count: "exact" });
  if (action) query = query.eq("action", action);
  const { data, error, count } = await query.order("created_at", { ascending: false }).order("id").range((page - 1) * 20, page * 20 - 1);
  if (error) throw new Error("Audit history could not be loaded.");
  return <><PageTitle eyebrow="STAFF WORKSPACE" title="Audit history">Recorded staff operations. Sensitive record contents and document details are excluded.</PageTitle><Card><Form action="" scroll={false} className="filter-toolbar"><label>Exact action name<Input key={action} name="action" defaultValue={action} maxLength={100} placeholder="For example: save_slot" /></label><Button type="submit">Filter activity</Button></Form></Card><div className="stack">{data.map(row => <Card key={row.id}><h2>{row.action.replaceAll("_", " ")}</h2><p>{row.entity_type} · {new Intl.DateTimeFormat("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }).format(new Date(row.created_at))}</p><small>Action code: {row.action}</small></Card>)}</div>{!data.length && <p>No matching audit activity.</p>}<Pagination page={page} count={count ?? 0} filters={{ action }} /></>;
}
