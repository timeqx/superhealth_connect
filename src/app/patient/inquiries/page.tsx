import { requireActor } from "@/server/session";
import { InquiryForm } from "@/features/inquiries/presentation/inquiry-form";
import { Card, PageTitle } from "@/shared/ui/components";
import { InquiryThread } from "@/features/inquiries/presentation/inquiry-thread";
import { InquiryReply } from "@/features/inquiries/presentation/inquiry-reply";
export default async function Inquiries() {
  const { client, user } = await requireActor();
  const { data, error } = await client
    .from("inquiries")
    .select("id,subject,status,inquiry_messages(id,body,is_draft)")
    .eq("patient_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (
    <>
      <PageTitle eyebrow="WE’RE HERE TO HELP" title="Inquiries">
        Send an account or appointment question. This is not an emergency
        service.
      </PageTitle>
      <div className="grid-two">
        <Card>
          <InquiryForm />
        </Card>
        <div className="stack">
          {data.map((i) => (
            <div className="stack" key={i.id}><InquiryThread
              key={i.id}
              subject={i.subject}
              status={i.status}
              messages={i.inquiry_messages}
            /><InquiryReply id={i.id} /></div>
          ))}
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
