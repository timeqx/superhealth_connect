"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Input } from "./input";
import { displayDateInput, parseDateInput } from "@/shared/lib/date-field";

type DateFieldProps = {
  name?: string; id?: string; value?: string; defaultValue?: string;
  onValueChange?: (value: string) => void;
  min?: string; max?: string; required?: boolean; disabled?: boolean;
  "aria-label": string;
};

export function DateField({ name, id, value, defaultValue = "", onValueChange, min, max, required, disabled, "aria-label": label }: DateFieldProps) {
  const [draft, setDraft] = useState({ source: value, iso: defaultValue, text: displayDateInput(value ?? defaultValue) });
  const input = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  if (value !== draft.source) setDraft({ source: value, iso: value ?? "", text: displayDateInput(value ?? "") });
  const selected = value ?? draft.iso;
  const parsed = parseDateInput(draft.text);
  const error = draft.text && !parsed ? "Enter a valid date as MM/DD/YYYY." : parsed && min && parsed < min ? `Choose ${displayDateInput(min)} or later.` : parsed && max && parsed > max ? `Choose ${displayDateInput(max)} or earlier.` : "";
  useEffect(() => { input.current?.setCustomValidity(error); }, [error]);
  useEffect(() => {
    const form = input.current?.form;
    const reset = () => { if (value === undefined) setDraft({ source: undefined, iso: defaultValue, text: displayDateInput(defaultValue) }); };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [value, defaultValue]);
  function choose(iso: string) {
    setDraft({ source: value, iso, text: displayDateInput(iso) });
    onValueChange?.(iso);
  }
  return <span className="date-field">
    <Input ref={input} id={id} type="text" inputMode="numeric" placeholder="MM/DD/YYYY" aria-label={label} aria-invalid={!!error} title={error || "Month / Day / Year (MM/DD/YYYY)"} autoComplete="off" maxLength={10} required={required} disabled={disabled} value={draft.text} onChange={event => {
      const text = event.target.value;
      const iso = parseDateInput(text);
      setDraft({ source: value, iso: iso ?? "", text });
      if (iso && (!min || iso >= min) && (!max || iso <= max)) onValueChange?.(iso);
      else if (!text) onValueChange?.("");
    }} onBlur={() => { if (parsed && !error) setDraft(current => ({ ...current, text: displayDateInput(parsed) })); }} />
    <button type="button" className="date-field-calendar" aria-label={label ? `Open calendar for ${label}` : "Open calendar"} disabled={disabled} onClick={() => {
      try { picker.current?.showPicker(); } catch { input.current?.focus(); }
    }}><CalendarDays size={18} aria-hidden="true" /></button>
    <input ref={picker} className="date-field-native" type="date" lang="en-US" value={selected} min={min} max={max} disabled={disabled} tabIndex={-1} aria-hidden="true" onChange={event => choose(event.target.value)} />
    {name && <input type="hidden" name={name} value={selected} disabled={disabled} />}
  </span>;
}

export function DateTimeField({ name, defaultValue = "", required, label }: { name: string; defaultValue?: string; required?: boolean; label: string }) {
  const [date, setDate] = useState(defaultValue.slice(0, 10));
  const [time, setTime] = useState(defaultValue.slice(11, 16));
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const form = container.current?.closest("form");
    const reset = () => { setDate(defaultValue.slice(0, 10)); setTime(defaultValue.slice(11, 16)); };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [defaultValue]);
  return <div ref={container} className="date-time-field">
    <DateField value={date} onValueChange={setDate} required={required} aria-label={`${label} date`} />
    <Input type="time" value={time} onChange={event => setTime(event.target.value)} required={required} aria-label={`${label} time`} />
    <input type="hidden" name={name} value={date && time ? `${date}T${time}` : ""} />
  </div>;
}
