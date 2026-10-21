"use client";
import { useRef, useState } from "react";
import { staffBook } from "../application/staff-actions";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { formatDate, formatTime } from "@/shared/lib/time";
export function StaffBook({ patients, slots }: { patients: { id: string; first_name: string; last_name: string }[]; slots: { id: string; starts_at: string; remaining: number }[] }) {
  const [pending, setPending] = useState(false); const [saved, setSaved] = useState(false); const [message, setMessage] = useState("");
  const attempt = useRef({ payload: "", key: "" });
  return <form className="stack" onSubmit={async e => {
    e.preventDefault(); if (pending || saved) return;
    const data = new FormData(e.currentTarget);
    const input = { patient: data.get("patient"), slot: data.get("slot"), reason: data.get("reason") };
    if (!window.confirm("Confirm the patient’s identity and consent to request this visit on their behalf. The request will reserve capacity pending approval.")) return;
    const payload = JSON.stringify(input); if (payload !== attempt.current.payload) attempt.current = { payload, key: crypto.randomUUID() };
    setPending(true);
    try { const result = await staffBook({ ...input, key: attempt.current.key }); setMessage(result.message); if (result.ok) setSaved(true); }
    catch { setMessage("Connection interrupted. Retry unchanged to confirm the request."); }
    finally { setPending(false); }
  }}><fieldset className="stack" disabled={pending || saved}><label>Patient<select name="patient" required><option value="">Choose the verified patient</option>{patients.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name} · {p.id.slice(-6)}</option>)}</select></label><label>Session · Manila time<select name="slot" required><option value="">Choose a session</option>{slots.map(s => <option key={s.id} value={s.id} disabled={s.remaining <= 0}>{formatDate(s.starts_at)} · {formatTime(s.starts_at)} · {s.remaining} available</option>)}</select></label><label>Reason for booking on behalf<Textarea name="reason" required maxLength={1000} /></label><Button type="submit">{pending ? "Submitting…" : "Request visit for patient"}</Button></fieldset><p role="status">{message}</p></form>;
}
