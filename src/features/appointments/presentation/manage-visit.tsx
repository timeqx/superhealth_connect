"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { manageVisit, visitAlternatives } from "../application/manage-visit-actions";
import type { Slot } from "../domain/appointment";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetTrigger } from "@/shared/ui/sheet";
import { SlotPicker } from "./booking-form";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/shared/ui/alert-dialog";
export function ManageVisit({ id, expected, asOf }: { id: string; expected: string; asOf: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"cancel" | "reschedule">("cancel");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const lock = useRef(false);
  const attempt = useRef<{ payload: string; key: string } | null>(null);
  async function load() {
    setPending(true); setMessage("");
    try { const result = await visitAlternatives(id); if (result.ok) setSlots(result.slots); else setMessage(result.message); }
    catch { setMessage("Could not load sessions. Try again."); } finally { setPending(false); }
  }
  async function submit() {
    if (lock.current || saved) return;
    lock.current = true; setPending(true);
    const input = { id, expected, action: mode, reason, ...(mode === "reschedule" ? { target } : {}) };
    const payload = JSON.stringify(input);
    if (attempt.current?.payload !== payload) attempt.current = { payload, key: crypto.randomUUID() };
    try { const result = await manageVisit({ ...input, key: attempt.current.key }); setMessage(result.message); if (result.ok) { setSaved(true); router.refresh(); } }
    catch { setMessage("Connection interrupted. Retry the same change to check whether it was saved."); }
    finally { lock.current = false; setPending(false); }
  }
  return <Sheet><SheetTrigger asChild><Button variant="outline">Manage appointment</Button></SheetTrigger><SheetContent><SheetTitle>Manage your visit</SheetTitle><SheetDescription>Changes are available before staff check-in.</SheetDescription>
    <label className="field">Change type<select value={mode} disabled={pending || saved} onChange={e => { const next = e.target.value as typeof mode; setMode(next); setMessage(""); if (next === "reschedule" && !slots) void load(); }}><option value="cancel">Cancel appointment</option><option value="reschedule">Reschedule</option></select></label>
    {mode === "cancel" ? <label className="field">Cancellation reason<Textarea value={reason} maxLength={1000} disabled={pending || saved} onChange={e => setReason(e.target.value)} /></label> : <><p className="notice">A new session requires staff approval again. If it is full, your original appointment stays unchanged.</p>{slots ? <fieldset disabled={pending || saved}><SlotPicker slots={slots} value={target} onChange={setTarget} asOf={asOf} /></fieldset> : <Button disabled={pending} variant="outline" onClick={() => void load()}>{pending ? "Loading sessions…" : "Retry loading sessions"}</Button>}</>}
    {message && <p role="status" className="notice">{message}</p>}
    <Button disabled={pending || saved || (mode === "cancel" ? !reason.trim() : !target)} onClick={() => setConfirm(true)}>{pending ? "Saving…" : "Review change"}</Button>
    <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{mode === "cancel" ? "Cancel this appointment?" : "Request the new session?"}</AlertDialogTitle><AlertDialogDescription>{mode === "cancel" ? "Your reservation will be released. Cancellation cannot be undone here." : "Your original session will be released only if the new reservation succeeds. The appointment returns to pending approval."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Go back</AlertDialogCancel><AlertDialogAction variant={mode === "cancel" ? "destructive" : "default"} onClick={() => void submit()}>Confirm change</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </SheetContent></Sheet>;
}
