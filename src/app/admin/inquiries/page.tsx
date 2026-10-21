import { Pagination, pageNumber } from "@/shared/ui/pagination";
import { requireActor } from "@/server/session";
import { Card, PageTitle } from "@/shared/ui/components";
import { AppointmentStatusBadge } from "@/shared/ui/care-components";
import { DetailDialog } from "@/shared/ui/detail-dialog";
import { InquiryReply } from "@/features/inquiries/presentation/inquiry-reply";
export default async function StaffInquiries({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { client } = await requireActor(true);
  const page = pageNumber((await searchParams).page);
  const { data, error, count } = await client.from("inquiries").select("id,subject,status,inquiry_messages(id,body,is_draft,created_at,updated_at)", { count: "exact" }).order("created_at", { ascending: false }).order("id").range((page - 1) * 20, page * 20 - 1);
  if (error) throw new Error("Inquiries could not be loaded.");
  return <><PageTitle eyebrow="STAFF WORKSPACE" title="Inquiry inbox">Browse all threads. Drafts stay private; published replies appear in the patient account.</PageTitle><div className="stack">{data.map(i => <Card className="inquiry-row" key={i.id}><div className="record-summary"><h2>{i.subject}</h2><p>{i.inquiry_messages.filter(m => !m.is_draft).length} published messages</p></div><AppointmentStatusBadge status={i.status} /><DetailDialog title={i.subject} description="Conversation and private staff drafts, oldest first." label="View conversation">{[...i.inquiry_messages].sort((a,b) => a.created_at.localeCompare(b.created_at)).map(m => <div className="inquiry-message" key={m.id}>{m.is_draft && <strong>Private draft · </strong>}{m.is_draft ? <InquiryReply key={m.updated_at} id={i.id} staff draft={m} /> : m.body}</div>)}<InquiryReply id={i.id} staff /></DetailDialog></Card>)}</div><Pagination page={page} count={count ?? 0} />{!data.length && <p>No inquiries yet.</p>}</>;
}

