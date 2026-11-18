"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { staffAppointmentAction } from "../application/staff-actions";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/shared/ui/alert-dialog";
import { useSnackbar } from "@/shared/ui/snackbar";

export function CancelApprovedAppointment({ id, expected, reference }: { id: string; expected: string; reference: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const attempt = useRef({ payload: "", key: "" });
  const router = useRouter();
  const notify = useSnackbar();
  async function cancel() {
    if (busy.current || saved || !reason.trim()) return;
    busy.current = true; setPending(true); setError("");
    const input = { id, expected, action: "cancel", reason: reason.trim() };
    const payload = JSON.stringify(input);
    if (attempt.current.payload !== payload) attempt.current = { payload, key: crypto.randomUUID() };
    try {
      const result = await staffAppointmentAction({ ...input, key: attempt.current.key });
      if (result.ok) { setSaved(true); setOpen(false); notify(result.message); router.refresh(); }
      else setError(result.message);
    } catch { setError("Connection interrupted. Retry with the same reason to confirm the result."); }
    finally { busy.current = false; setPending(false); }
  }
  return <>
    <Button variant="outline" disabled={pending || saved} onClick={() => setOpen(true)}>Cancel appointment</Button>
    <AlertDialog open={open} onOpenChange={value => { if (!busy.current) setOpen(value); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel {reference}?</AlertDialogTitle>
          <AlertDialogDescription>This cancels the approved appointment and releases its reservation. The patient will be notified and can see your reason.</AlertDialogDescription>
        </AlertDialogHeader>
        <label className="field">Cancellation reason (required)
          <Textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} disabled={pending} placeholder="For example: Staff emergency. Please book another available session." required />
        </label>
        {error && <p className="notice" role="alert">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Go back</AlertDialogCancel>
          <Button variant="destructive" disabled={pending || saved || !reason.trim()} onClick={() => void cancel()}>{pending ? "Cancelling…" : "Confirm cancellation"}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
