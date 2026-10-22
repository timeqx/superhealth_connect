import Form from "next/form";
import { DetailDialog } from "@/shared/ui/detail-dialog";
import Link from "next/link";
import { requireActor } from "@/server/session";
import { PageTitle, Card } from "@/shared/ui/components";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { StaffVisitControls } from "@/features/appointments/presentation/staff-visit-controls";
import { AppointmentStatusBadge } from "@/shared/ui/care-components";
import { formatDate, formatTime } from "@/shared/lib/time";
const states = ["pending", "scheduled", "checked_in", "in_service", "completed", "cancelled", "rejected", "no_show"];
export default async function StaffHistory({ searchParams }: { searchParams: Promise<{ page?: string; status?: string; reference?: string }> }) {
  const { client } = await requireActor(true);
  const params = await searchParams;
  const page = Math.min(10000, Math.max(1, Number(params.page) || 1)) | 0;
  const status = states.includes(params.status ?? "") ? params.status! : "";
  const reference = (params.reference ?? "").trim().slice(0, 80);
  let query = client.from("appointments").select("id,public_reference,status,updated_at,decision_reason,requested_at,profiles!appointments_patient_id_fkey(first_name,last_name),service_slots!appointments_slot_id_fkey(starts_at,services(name))", { count: "exact" });
  if (status) query = query.eq("status", status);
  if (reference) query = query.eq("public_reference", reference);
  const { data, error, count } = await query.order("requested_at", { ascending: false }).order("id").range((page - 1) * 20, page * 20 - 1);
  if (error) throw new Error("Appointment history could not be loaded.");
  const href = (p: number) => `?${new URLSearchParams({ status, reference, page: String(p) })}`;
  return <><PageTitle eyebrow="STAFF WORKSPACE" title="Appointment history">Find visits, review their current state, and record cancellations or no-shows.</PageTitle><p><Link href="/admin/book">Book on behalf of a patient →</Link></p><Card><Form action="" scroll={false} className="filter-toolbar"><label>Status<select key={status} name="status" defaultValue={status}><option value="">All statuses</option>{states.map(s => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}</select></label><label>Exact appointment reference<Input key={reference} name="reference" defaultValue={reference} maxLength={80} /></label><Button type="submit">Filter visits</Button></Form></Card><p>{count ?? 0} matching visits</p><div className="stack">{data.map(a => {
    const person = a.profiles as unknown as { first_name: string; last_name: string };
    const slot = a.service_slots as unknown as { starts_at: string; services: { name: string } };
    return <Card className="history-row" key={`${a.id}:${a.updated_at}`}><div className="record-summary"><h2>{a.public_reference}</h2><p>{person?.first_name} {person?.last_name}</p></div><div><strong>{slot?.services?.name}</strong><p>{slot && `${formatDate(slot.starts_at)} · ${formatTime(slot.starts_at)}`}</p></div><AppointmentStatusBadge status={a.status} /><DetailDialog title={a.public_reference} description="Visit details and staff actions" label="View visit"><p>{person?.first_name} {person?.last_name} · {slot?.services?.name}</p><AppointmentStatusBadge status={a.status} />{a.decision_reason && <p>{a.decision_reason}</p>}<StaffVisitControls id={a.id} expected={a.updated_at} status={a.status} /></DetailDialog></Card>;
  })}</div><nav aria-label="History pages">{page > 1 && <Link href={href(page - 1)}>Previous · </Link>}Page {page}{page * 20 < (count ?? 0) && <Link href={href(page + 1)}> · Next</Link>}</nav></>;
}
