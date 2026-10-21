"use client";
import { useSnackbar } from "@/shared/ui/snackbar";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { staffAppointmentAction } from "../application/staff-actions";
import { Textarea } from "@/shared/ui/textarea";
import { Button } from "@/shared/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/shared/ui/alert-dialog";
export function StaffVisitControls({ id, expected, status }: { id: string; expected: string; status: string }) {
  const [reason, setReason] = useState("");
  const [action, setAction] = useState<"cancel" | "no_show" | null>(null);
  const [pending, setPending] = useState(false);
  const notify = useSnackbar();
  const [saved, setSaved] = useState(false);
  const attempt = useRef({ payload: "", key: "" });
  const busy = useRef(false);
  const router = useRouter();
  async function submit(value: "cancel" | "no_show") {
    if (busy.current || saved) return;
    busy.current = true; setPending(true);
    const data = { id, expected, action: value, reason };
    const payload = JSON.stringify(data);
    if (payload !== attempt.current.payload) attempt.current = { payload, key: crypto.randomUUID() };
    try {
      const result = await staffAppointmentAction({ ...data, key: attempt.current.key });
      notify(result.message, !result.ok);
      if (result.ok) { setSaved(true); router.refresh(); }
    } catch { notify("Connection interrupted. Retry unchanged to confirm the result."); }
    finally { busy.current = false; setPending(false); }
  }
  if (!["pending", "scheduled", "checked_in"].includes(status)) return null;
  return <div className="stack"><label>Reason visible to patient<Textarea maxLength={1000} disabled={pending || saved} value={reason} onChange={e => setReason(e.target.value)} /></label><div className="actions"><Button variant="outline" disabled={pending || saved || !reason.trim()} onClick={() => setAction("cancel")}>Cancel visit</Button>{status !== "pending" && <Button variant="outline" disabled={pending || saved || !reason.trim()} onClick={() => setAction("no_show")}>Mark no-show</Button>}</div><AlertDialog open={action !== null} onOpenChange={open => { if (!open) setAction(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{action === "no_show" ? "Mark this visit as a no-show?" : "Cancel this visit?"}</AlertDialogTitle><AlertDialogDescription>Confirm the patient and the center’s policy before continuing. This releases the reservation and resolves any waiting, called or skipped ticket. Your reason is recorded and shown to the patient.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Go back</AlertDialogCancel><AlertDialogAction onClick={() => { if (action) void submit(action); }}>Confirm change</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div>;
}
