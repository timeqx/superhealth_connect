"use client";
import { useSnackbar } from "@/shared/ui/snackbar";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveOperations } from "./actions";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
export type Service = { id: string; name: string; requirements: string; arrival_minutes: number; is_published: boolean; is_bookable: boolean };
export type Slot = { id: string; service_id: string; starts_at: string; ends_at: string; capacity: number; is_open: boolean; updated_at: string };
export function OperationsForm({ service, slot, services }: { service?: Service; slot?: Slot; services?: Service[] }) {
  const [pending, setPending] = useState(false);
  const notify = useSnackbar();
  const retry = useRef({ payload: "", key: "" });
  const router = useRouter();
  return <form className="operations-form" onSubmit={async event => {
    event.preventDefault(); if (pending) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = service ? { id: service.id, requirements: data.get("requirements"), arrival: data.get("arrival"), published: data.has("published"), bookable: data.has("bookable") } : { id: slot?.id ?? null, service: slot?.service_id ?? data.get("service"), start: slot?.starts_at ?? data.get("start"), end: slot?.ends_at ?? data.get("end"), capacity: data.get("capacity"), open: data.has("open"), expected: slot?.updated_at ?? null };
    if (!window.confirm("Save these operational settings? Please confirm they match the center’s approved schedule and policies.")) return;
    const signature = JSON.stringify(payload);
    if (signature !== retry.current.payload) retry.current = { payload: signature, key: crypto.randomUUID() };
    setPending(true);
    try {
      const result = await saveOperations(service ? "service" : "slot", { ...payload, key: retry.current.key });
      notify(result.message, !result.ok);
      if (result.ok) { retry.current = { payload: "", key: "" }; if (!service && !slot) form.reset(); router.refresh(); }
    } catch { notify("Connection interrupted. Retry to confirm the result.", true); }
    finally { setPending(false); }
  }}>
    <fieldset disabled={pending} className="form-grid">
      {service ? <><label>Patient requirements<Textarea name="requirements" defaultValue={service.requirements} required maxLength={2000} /></label><label>Arrival minutes before session<Input name="arrival" type="number" min={0} max={240} defaultValue={service.arrival_minutes} required /></label><label className="checkbox-field"><input type="checkbox" name="published" defaultChecked={service.is_published} /> Published in service directory</label><label className="checkbox-field"><input type="checkbox" name="bookable" defaultChecked={service.is_bookable} /> Accept online bookings</label></> : <>
        {!slot && <><label>Service<select name="service" required>{services?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Start · Manila time<Input name="start" type="datetime-local" required /></label><label>End · Manila time<Input name="end" type="datetime-local" required /></label></>}
        <label>Capacity<Input type="number" name="capacity" min={1} max={500} defaultValue={slot?.capacity ?? 10} required /></label><label className="checkbox-field"><input name="open" type="checkbox" defaultChecked={slot?.is_open ?? false} /> Open for requests</label>
      </>}
      <Button type="submit">{pending ? "Saving…" : service ? "Save service" : slot ? "Save session" : "Create session"}</Button>
    </fieldset>
  </form>;
}
