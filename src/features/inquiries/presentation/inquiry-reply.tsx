"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { replyInquiry } from "../application-actions";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
export function InquiryReply({ id, staff = false, draft }: { id: string; staff?: boolean; draft?: { id: string; body: string; updated_at: string } }) {
  const router = useRouter(); const [body, setBody] = useState(draft?.body ?? ""); const [status, setStatus] = useState("in_progress");
  const [message, setMessage] = useState(""); const [pending, setPending] = useState(false);
  const busy = useRef(false); const attempt = useRef<{ payload: string; key: string } | null>(null);
  async function submit(publish: boolean) {
    if (busy.current || !body.trim()) return;
    busy.current = true; setPending(true);
    const input = { id, body, draft: draft?.id, expected: draft?.updated_at, publish, status: staff ? status : "open" }; const payload = JSON.stringify(input);
    if (attempt.current?.payload !== payload) attempt.current = { payload, key: crypto.randomUUID() };
    try { const result = await replyInquiry({ ...input, key: attempt.current.key }); setMessage(result.message); if (result.ok) { if (publish) setBody(""); attempt.current = null; router.refresh(); } }
    catch { setMessage("Connection interrupted. Retry unchanged to check your reply."); } finally { busy.current = false; setPending(false); }
  }
  return <div className="form"><label className="field">{staff ? "Staff response" : "Your reply"}<Textarea maxLength={4000} value={body} disabled={pending} onChange={e => setBody(e.target.value)} /></label>
    {staff && <label className="field">Thread status<select disabled={pending} value={status} onChange={e => setStatus(e.target.value)}><option value="in_progress">In progress</option><option value="waiting_for_follow_up">Waiting for follow-up</option><option value="resolved">Resolved</option><option value="open">Open</option></select></label>}
    <div className="actions"><Button disabled={pending || !body.trim()} onClick={() => void submit(true)}>Send reply</Button>{staff && <Button variant="outline" disabled={pending || !body.trim()} onClick={() => void submit(false)}>Save private draft</Button>}</div>{message && <p role="status" className="notice">{message}</p>}
  </div>;
}
