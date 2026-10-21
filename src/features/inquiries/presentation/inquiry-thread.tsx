import { Card } from "@/shared/ui/components";
import { AppointmentStatusBadge } from "@/shared/ui/care-components";
import { MessageCircle } from "lucide-react";
export function InquiryThread({
  subject,
  status,
  messages,
}: {
  subject: string;
  status: string;
  messages: { id: string; body: string; is_draft: boolean }[];
}) {
  return (
    <Card>
      <div className="row">
        <MessageCircle size={22} />
        <AppointmentStatusBadge status={status} />
      </div>
      <h2>{subject}</h2>
      {messages
        .filter((m) => !m.is_draft)
        .map((m) => (
          <p className="inquiry-message" key={m.id}>
            {m.body}
          </p>
        ))}
    </Card>
  );
}
