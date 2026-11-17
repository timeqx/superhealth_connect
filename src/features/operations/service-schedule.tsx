"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveServiceSchedule } from "./actions";
import { useSnackbar } from "@/shared/ui/snackbar";
import { Button } from "@/shared/ui/button";
import { ScheduleFields, type ScheduleSettings } from "./schedule-fields";

export type ServiceSchedule = ScheduleSettings & { id: string; updated_at: string };

export function ServiceScheduleForm({ service, previewContainer }: { service: ServiceSchedule; previewContainer?: HTMLElement | null }) {
  const [pending, setPending] = useState(false);
  const attempt = useRef({ payload: "", key: "" });
  const notify = useSnackbar();
  const router = useRouter();
  return <form className="operations-form" onSubmit={async event => {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const input = { service: service.id, open: data.get("open"), close: data.get("close"), duration: data.get("duration"), capacity: data.get("capacity"), days: data.getAll("days"), expected: service.updated_at };
    const payload = JSON.stringify(input);
    if (attempt.current.payload !== payload) attempt.current = { payload, key: crypto.randomUUID() };
    setPending(true);
    try {
      const result = await saveServiceSchedule({ ...input, key: attempt.current.key });
      notify(result.message, !result.ok);
      if (result.ok) { attempt.current = { payload: "", key: "" }; router.refresh(); }
    } catch { notify("Connection interrupted. Retry unchanged to confirm the result.", true); }
    finally { setPending(false); }
  }}>
    <fieldset disabled={pending} className="form-grid">
      <ScheduleFields schedule={service} previewContainer={previewContainer} />
      <p className="caption col-span-full">Sessions open automatically for the next 30 days. Changes apply to future dates without appointments or manual overrides. Dates with existing appointments or manual overrides keep their settings. Close individual sessions in Sessions, or turn off online booking to pause the entire service.</p>
      <Button type="submit">{pending ? "Saving…" : "Save session schedule"}</Button>
    </fieldset>
  </form>;
}
