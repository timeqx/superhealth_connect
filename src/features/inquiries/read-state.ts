type InquiryMessage = {
  author_id: string;
  is_draft: boolean;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

function compareTimestamps(left: string, right: string) {
  const milliseconds = Date.parse(left) - Date.parse(right);
  // Keep PostgreSQL's microseconds: Date alone rounds distinct updates together.
  const fraction = (value: string) => (value.match(/\.(\d+)/)?.[1] ?? "").padEnd(6, "0");
  return milliseconds || fraction(left).localeCompare(fraction(right));
}

/** The last incoming update actually rendered in this conversation. */
export function inquiryReadThrough(messages: InquiryMessage[], patientId: string, staff = false) {
  let through: string | undefined;
  for (const message of messages) {
    if (message.is_draft || (staff ? message.author_id !== patientId : message.author_id === patientId)) continue;
    for (const timestamp of [message.published_at ?? message.created_at, message.updated_at]) {
      if (!through || compareTimestamps(timestamp, through) > 0) through = timestamp;
    }
  }
  return through;
}
