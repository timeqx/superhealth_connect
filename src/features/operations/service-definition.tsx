"use client";
import { useSnackbar } from "@/shared/ui/snackbar";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveDefinition } from "./actions";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Button } from "@/shared/ui/button";
import { ScheduleFields } from "./schedule-fields";
export function ServiceDefinition({ service }: { service?: { id: string; name: string; slug: string; description: string; updated_at: string } }) {
  const [pending, setPending] = useState(false);
  const [scheduleVersion, setScheduleVersion] = useState(0);
  const notify = useSnackbar();
  const attempt = useRef({ payload: "", key: "" });
  const router = useRouter();
  return <form className="operations-form" onSubmit={async e => {
    e.preventDefault(); if (pending) return;
    const form = e.currentTarget; const data = new FormData(form);
    const input = {
      id: service?.id ?? null,
      expected: service?.updated_at ?? null,
      name: data.get("name"),
      slug: data.get("slug"),
      description: data.get("description"),
      ...(!service ? {
        open: data.get("open"),
        close: data.get("close"),
        duration: data.get("duration"),
        capacity: data.get("capacity"),
        days: data.getAll("days"),
      } : {}),
    };
    const payload = JSON.stringify(input);
    if (payload !== attempt.current.payload) attempt.current = { payload, key: crypto.randomUUID() };
    setPending(true);
    try { const result = await saveDefinition({ ...input, key: attempt.current.key }); notify(result.message, !result.ok); if (result.ok) { if (!service) { form.reset(); setScheduleVersion(value => value + 1); } attempt.current = { payload: "", key: "" }; router.refresh(); } }
    catch { notify("Connection interrupted. Retry unchanged to confirm the result.", true); }
    finally { setPending(false); }
  }}>
    <fieldset disabled={pending} className="form-grid">
      <label>Service name<Input name="name" defaultValue={service?.name} required minLength={2} maxLength={120} /></label>
      <label>Service identifier<Input name="slug" defaultValue={service?.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" required maxLength={100} /></label>
      <label>Description<Textarea name="description" defaultValue={service?.description} required maxLength={2000} /></label>
      {!service && <>
        <ScheduleFields key={scheduleVersion} />
        <p className="caption col-span-full">Once published and enabled for booking, this service will offer time slots for the next 30 days. Each patient books one space in a time slot.</p>
      </>}
      <Button type="submit">{pending ? "Saving…" : service ? "Save service details" : "Create draft service"}</Button>
    </fieldset>
  </form>;
}
