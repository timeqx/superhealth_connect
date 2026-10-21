import { requireActor } from "@/server/session";
import { Card, PageTitle } from "@/shared/ui/components";
import { AppointmentStatusBadge } from "@/shared/ui/care-components";
import { InquiryReply } from "@/features/inquiries/presentation/inquiry-reply";
export default async function StaffInquiries() {
  const { client } = await requireActor(true);
  const { data, error } = await client.from("inquiries").select("id,subject,status,inquiry_messages(id,body,is_draft,created_at)").order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error("Inquiries could not be loaded.");
  return <><PageTitle eyebrow="STAFF WORKSPACE" title="Inquiry inbox">Latest 50 threads. Drafts stay private; published replies appear in the patient account.</PageTitle><div className="stack">{data.map(i => <Card key={i.id}><AppointmentStatusBadge status={i.status} /><h2>{i.subject}</h2>{[...i.inquiry_messages].sort((a,b) => a.created_at.localeCompare(b.created_at)).map(m => <div className="inquiry-message" key={m.id}>{m.is_draft && <strong>Private draft · </strong>}{m.body}</div>)}<InquiryReply id={i.id} staff /></Card>)}</div>{!data.length && <p>No inquiries yet.</p>}</>;
}

