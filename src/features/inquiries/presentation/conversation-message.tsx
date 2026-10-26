import type { ReactNode } from "react";
import { formatDate, formatTime } from "@/shared/lib/time";

export function ConversationMessage({ name, staff, createdAt, draft = false, children }: {
  name: string; staff: boolean; createdAt: string; draft?: boolean; children: ReactNode;
}) {
  return <article className="conversation-message" data-sender={staff ? "staff" : "patient"}>
    <header><strong>{name}</strong><span>{staff ? "Staff" : "Patient"}{draft ? " · Private draft" : ""}</span>
      <time dateTime={createdAt}>{formatDate(createdAt)} · {formatTime(createdAt)}</time>
    </header>
    <div className="message-body">{children}</div>
  </article>;
}
