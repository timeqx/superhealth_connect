"use client";

import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";

export type ScheduleSettings = {
  opening_time: string;
  closing_time: string;
  slot_duration_minutes: number;
  slot_capacity: number;
  weekdays: number[];
};

const defaultSchedule: ScheduleSettings = {
  opening_time: "08:00",
  closing_time: "17:00",
  slot_duration_minutes: 30,
  slot_capacity: 1,
  weekdays: [1, 2, 3, 4, 5],
};
const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function clockMinutes(value: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return NaN;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function clockLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  return `${hours % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}

export function ScheduleFields({ schedule = defaultSchedule, previewContainer }: { schedule?: ScheduleSettings; previewContainer?: HTMLElement | null }) {
  const previewId = useId();
  const [open, setOpen] = useState(schedule.opening_time.slice(0, 5));
  const [close, setClose] = useState(schedule.closing_time.slice(0, 5));
  const [duration, setDuration] = useState(String(schedule.slot_duration_minutes));
  const [capacity, setCapacity] = useState(String(schedule.slot_capacity));
  const [weekdays, setWeekdays] = useState(schedule.weekdays);
  const start = clockMinutes(open);
  const end = clockMinutes(close);
  const minutes = Number(duration);
  const patients = Number(capacity);
  const validHours = Number.isFinite(start) && Number.isFinite(end) && end > start;
  const validDuration = Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440;
  const validCapacity = Number.isInteger(patients) && patients >= 1 && patients <= 500;
  const slotCount = validHours && validDuration ? Math.floor((end - start) / minutes) : 0;
  const showSessions = validCapacity && slotCount > 0 && weekdays.length > 0;
  const preview = showSessions ? <section className="col-span-full" aria-labelledby={`${previewId}-title`}>
    <h3 id={`${previewId}-title`}>Daily session preview</h3>
    <p className="caption">These sessions repeat on each selected day. Each session has its own patient capacity.</p>
    <ol className="session-preview-list" tabIndex={0} aria-label="Sessions and patient slots">
      {Array.from({ length: slotCount }, (_, index) => <li key={index}>
        <strong>{clockLabel(start + index * minutes)}–{clockLabel(start + (index + 1) * minutes)}</strong>
        <span>{patients} patient {patients === 1 ? "slot" : "slots"}</span>
      </li>)}
    </ol>
    {slotCount === 1 && <p className="caption">This creates one session for the day. Choose a shorter session duration to offer patients several appointment times.</p>}
  </section> : null;

  return (
    <fieldset className="form-grid col-span-full">
      <legend>Daily service sessions · Manila time</legend>
      <label>
        Opening time
        <Input name="open" type="time" required value={open} onChange={event => setOpen(event.target.value)} />
      </label>
      <label>
        Closing time
        <Input name="close" type="time" required value={close} min={open || undefined} onChange={event => setClose(event.target.value)} />
      </label>
      <label>
        Session duration (minutes)
        <Input name="duration" type="number" min={1} max={validHours ? Math.min(1440, end - start) : 1440} step={1} required value={duration} onChange={event => setDuration(event.target.value)} aria-describedby={previewId} />
        <small>60 minutes = 1 hour per session.</small>
      </label>
      <label>
        Patient slots per session
        <Input name="capacity" type="number" min={1} max={500} step={1} required value={capacity} onChange={event => setCapacity(event.target.value)} aria-describedby={previewId} />
        <small>How many patients can book the same session.</small>
      </label>
      <div className="actions session-duration-presets col-span-full" role="group" aria-label="Common session durations">
        {[30, 60, 120].map(value => <Button key={value} type="button" variant="outline" size="sm" className="min-h-11" aria-pressed={minutes === value} onClick={() => setDuration(String(value))}>{value === 30 ? "30 minutes" : value === 60 ? "1 hour" : "2 hours"}</Button>)}
      </div>
      <fieldset className="col-span-full">
        <legend>Available days</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {dayNames.map((day, index) => (
            <label className="flex min-h-11 items-center gap-2" key={day}>
              <input name="days" type="checkbox" value={index} checked={weekdays.includes(index)} onChange={event => setWeekdays(current => event.target.checked ? [...current, index].sort() : current.filter(value => value !== index))} />
              {day}
            </label>
          ))}
        </div>
      </fieldset>
      <p id={previewId} className="notice col-span-full" role="status">
        {!validHours
          ? "Closing time must be after opening time."
          : !validDuration || !validCapacity
            ? "Enter a whole-number session duration and patient capacity to preview your sessions."
            : !slotCount
              ? "Session duration must fit within the service hours."
              : !weekdays.length
                ? "No available days selected. Regular sessions will not be generated."
                : <>
                    <strong>{slotCount} {slotCount === 1 ? "session" : "sessions"} per day × {patients} patient {patients === 1 ? "slot" : "slots"} per session = {slotCount * patients} {slotCount * patients === 1 ? "patient" : "patients"} per day.</strong>
                    {" "}Patients choose one session and reserve one place in that session.
                    {(end - start) % minutes > 0 && <> The last session ends at {clockLabel(start + slotCount * minutes)}; the remaining time is not bookable.</>}
                  </>}
      </p>
      {previewContainer === undefined ? preview : previewContainer ? createPortal(preview, previewContainer) : null}
    </fieldset>
  );
}
