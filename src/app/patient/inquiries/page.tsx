import { requireActor } from "@/server/session";
import { InquiryForm } from "@/features/inquiries/presentation/inquiry-form";
import { Card, PageTitle } from "@/shared/ui/components";
import { AppointmentStatusBadge } from "@/shared/ui/care-components";
import { DetailDialog } from "@/shared/ui/detail-dialog";
import { InquiryReply } from "@/features/inquiries/presentation/inquiry-reply";
export default async function Inquiries() {
  const { client, user } = await requireActor();
  const { data, error } = await client
    .from("inquiries")
    .select("id,subject,status,inquiry_messages(id,body,is_draft,created_at)")
    .eq("patient_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (
    <>
      <PageTitle eyebrow="WE’RE HERE TO HELP" title="Inquiries">
        Send an account or appointment question. This is not an emergency
        service.
      </PageTitle>
      <div className="inquiries-layout">
        <Card>
          <h2>New inquiry</h2>
          <InquiryForm />
        </Card>
        <div className="stack">
          <h2>Your conversations</h2>
          {data.map((i) => {
            const messages = i.inquiry_messages.filter(m => !m.is_draft).sort((a, b) => a.created_at.localeCompare(b.created_at));
            return <Card className="inquiry-row" key={i.id}>
              <div className="record-summary"><h3>{i.subject}</h3><p className="message-preview">{messages.at(-1)?.body || "No published messages yet."}</p></div>
              <AppointmentStatusBadge status={i.status} />
              <DetailDialog title={i.subject} description="Your messages and published staff replies, oldest first." label="View conversation">
                <AppointmentStatusBadge status={i.status} />
                {messages.map(m => <p className="inquiry-message" key={m.id}>{m.body}</p>)}
                <InquiryReply id={i.id} />
              </DetailDialog>
            </Card>;
          })}
          {!data.length && (
            <Card>
              <h2>No inquiries yet</h2>
              <p>Your messages and published staff replies will appear here.</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
