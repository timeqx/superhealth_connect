"use client";

import { useId, useState } from "react";
import { Input } from "@/shared/ui/input";

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
  if (!/^\d{2}:\d{2}$/.test(value)) return NaN;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function clockLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  return `${hours % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${hours < 12 ? "AM" : "PM"}`;
}

export function ScheduleFields({ schedule = defaultSchedule }: { schedule?: ScheduleSettings }) {
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

  return (
    <fieldset className="form-grid col-span-full">
      <legend>Appointment schedule · Manila time</legend>
      <label>
        Opening time
        <Input name="open" type="time" required value={open} onChange={event => setOpen(event.target.value)} />
      </label>
      <label>
        Closing time
        <Input name="close" type="time" required value={close} min={open || undefined} onChange={event => setClose(event.target.value)} />
      </label>
      <label>
        Appointment length (minutes)
        <Input name="duration" type="number" min={1} max={validHours ? Math.min(1440, end - start) : 1440} step={1} required value={duration} onChange={event => setDuration(event.target.value)} aria-describedby={previewId} />
      </label>
      <label>
        Patients per time slot
        <Input name="capacity" type="number" min={1} max={500} step={1} required value={capacity} onChange={event => setCapacity(event.target.value)} aria-describedby={previewId} />
      </label>
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
            ? "Enter a whole-number appointment length and patient capacity to preview your time slots."
            : !slotCount
              ? "Appointment length must fit within the service hours."
              : !weekdays.length
                ? "No available days selected. Regular time slots will not be generated."
                : <>
                    {slotCount} time {slotCount === 1 ? "slot" : "slots"} per day, up to {slotCount * patients} {slotCount * patients === 1 ? "patient" : "patients"}.
                    {" "}For example, {clockLabel(start)}–{clockLabel(start + minutes)} can accommodate {patients} {patients === 1 ? "patient" : "patients"}.
                    {(end - start) % minutes > 0 && <> The last slot ends at {clockLabel(start + slotCount * minutes)}; the remaining time is not bookable.</>}
                  </>}
      </p>
    </fieldset>
  );
}
