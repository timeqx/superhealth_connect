"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveServiceSchedule } from "./actions";
import { useSnackbar } from "@/shared/ui/snackbar";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";

export type ServiceSchedule = { id: string; opening_time: string; closing_time: string; daily_capacity: number; weekdays: number[]; updated_at: string };
const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function ServiceScheduleForm({ service }: { service: ServiceSchedule }) {
  const [pending, setPending] = useState(false);
  const attempt = useRef({ payload: "", key: "" });
  const notify = useSnackbar();
  const router = useRouter();
  return <form className="operations-form" onSubmit={async event => {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const input = { service: service.id, open: data.get("open"), close: data.get("close"), capacity: data.get("capacity"), days: data.getAll("days"), expected: service.updated_at };
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
      <legend>Regular service hours · Manila time</legend>
      <label>Opening time<Input name="open" type="time" required defaultValue={service.opening_time.slice(0, 5)} /></label>
      <label>Closing time<Input name="close" type="time" required defaultValue={service.closing_time.slice(0, 5)} /></label>
      <label>Patients per day<Input name="capacity" type="number" min={1} max={500} required defaultValue={service.daily_capacity} /></label>
      <fieldset><legend>Available days</legend>{days.map((day, index) => <label className="checkbox-field" key={day}><input name="days" type="checkbox" value={index} defaultChecked={service.weekdays.includes(index)} />{day}</label>)}</fieldset>
      <p className="caption">Sessions open automatically for the next 30 days. Changes apply to future sessions without appointments. Booked sessions and individual date overrides keep their settings. Close a date in Sessions, or turn off online booking to pause the entire service.</p>
      <Button type="submit">{pending ? "Saving…" : "Save regular hours"}</Button>
    </fieldset>
  </form>;
}
