"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { decideAppointment } from "../application/decision-actions";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/shared/ui/alert-dialog";

export function AppointmentDecision({ id, expected }: { id: string; expected: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const busy = useRef(false);
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  async function submit(action: "approve" | "reject") {
    if (busy.current || saved) return;
    busy.current = true; setPending(true); setMessage("");
    const input = { id, expected, decision: action, reason: reason.trim() };
    const payload = JSON.stringify(input);
    if (attempt.current?.payload !== payload) attempt.current = { payload, key: crypto.randomUUID() };
    try {
      const result = await decideAppointment({ ...input, key: attempt.current.key });
      setMessage(result.message);
      if (result.ok) { setSaved(true); router.refresh(); }
    } catch {
      setMessage("Connection interrupted. Retry the same decision to check whether it was saved.");
    } finally { busy.current = false; setPending(false); }
  }
  return <div className="form">
    <Label htmlFor={`decision-reason-${id}`}>Note to patient (required when declining)</Label>
    <Textarea id={`decision-reason-${id}`} maxLength={1000} value={reason} disabled={pending || saved} onChange={e => setReason(e.target.value)} placeholder="Explain the decision or provide next steps." />
    <div className="actions"><Button disabled={pending || saved} onClick={() => setDecision("approve")}>{pending ? "Saving decision…" : "Approve appointment"}</Button><Button variant="outline" disabled={pending || saved || !reason.trim()} onClick={() => setDecision("reject")}>Decline request</Button></div>
    {message && <p role="status" className="notice">{message}</p>}
    {!saved && <Button variant="ghost" disabled={pending} onClick={() => router.refresh()}>Refresh latest request</Button>}
    <AlertDialog open={decision !== null} onOpenChange={open => { if (!open) setDecision(null); }}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{decision === "approve" ? "Schedule this appointment?" : "Decline this appointment request?"}</AlertDialogTitle><AlertDialogDescription>{decision === "approve" ? "This confirms the requested session. It does not check the patient in or issue a queue ticket." : "The reservation will be released and the patient will see your reason. This decision cannot be undone here."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Go back</AlertDialogCancel><AlertDialogAction variant={decision === "reject" ? "destructive" : "default"} onClick={() => { if (decision) void submit(decision); }}>Confirm decision</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </div>;
}
