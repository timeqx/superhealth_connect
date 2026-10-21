"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { queueOperation } from "./actions";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/shared/ui/alert-dialog";
export function QueueAction({ id, action, ticket, label, disabled = false }: { id: string; action: "check_in" | "call_next" | "start" | "complete" | "skip" | "requeue" | "close"; ticket?: string; label: string; disabled?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const lock = useRef(false);
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  async function submit() {
    if (lock.current || saved) return;
    lock.current = true; setPending(true);
    const input = { id, action, ticket, ...(action === "check_in" ? { reason } : {}) };
    const payload = JSON.stringify(input);
    if (attempt.current?.payload !== payload) attempt.current = { payload, key: crypto.randomUUID() };
    try { const result = await queueOperation({ ...input, key: attempt.current.key }); setMessage(result.message); if (result.ok) { setSaved(true); router.refresh(); } }
    catch { setMessage("Connection interrupted. Retry this action to check whether it was saved."); }
    finally { lock.current = false; setPending(false); }
  }
  return <div className="stack"><Button variant={action === "skip" || action === "close" ? "outline" : "default"} disabled={pending || saved || disabled} onClick={() => setOpen(true)}>{pending ? "Saving…" : label}</Button>{message && <p role="status" className="notice">{message}</p>}
    <AlertDialog open={open} onOpenChange={setOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{label}?</AlertDialogTitle><AlertDialogDescription>{action === "check_in" ? "Confirm the patient has arrived. Staff check-in issues their queue ticket. For arrival outside the normal window, explain the override below; the service date must still be today." : "Confirm this change to the live queue. The server checks the latest state before applying it."}</AlertDialogDescription></AlertDialogHeader>
      {action === "check_in" && <label className="field">Arrival override reason (only when needed)<Textarea value={reason} maxLength={1000} onChange={e => setReason(e.target.value)} /></label>}
      <AlertDialogFooter><AlertDialogCancel>Go back</AlertDialogCancel><AlertDialogAction onClick={() => void submit()}>Confirm</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
