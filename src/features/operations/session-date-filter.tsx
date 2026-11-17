"use client";

import { useEffect, useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { DateField } from "@/shared/ui/date-field";
import { shiftDate } from "@/shared/lib/date-field";

const href = (date: string) => date ? `/admin/schedules?${new URLSearchParams({ date })}` : "/admin/schedules";
export function SessionDateFilter({ date, today }: { date: string; today: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useOptimistic(date);
  const anchor = selected || today;
  const previous = shiftDate(anchor, -1);
  const next = shiftDate(anchor, 1);
  useEffect(() => {
    if (previous >= today) router.prefetch(href(previous));
    router.prefetch(href(next));
  }, [router, previous, next, today]);
  function navigate(value: string) {
    if (pending || value === date) return;
    startTransition(() => { setSelected(value); router.replace(href(value), { scroll: false }); });
  }
  return <div className="session-date-filter" aria-busy={pending}>
    <label className="field">Session date · Manila time<DateField aria-label="Session date · Manila time" value={selected} min={today} onValueChange={navigate} disabled={pending} /></label>
    <div className="actions session-day-controls" aria-label="Change session date">
      <Button type="button" variant="outline" className="px-3" disabled={pending || previous < today} onClick={() => navigate(previous)}><ChevronLeft size={16} aria-hidden="true" />Previous day</Button>
      <Button type="button" variant="outline" className="px-3" disabled={pending} onClick={() => navigate(next)}>Next day<ChevronRight size={16} aria-hidden="true" /></Button>
      <Button type="button" variant="outline" disabled={pending} onClick={() => navigate(today)}>Today</Button>
      <Button type="button" variant="ghost" disabled={pending || !selected} onClick={() => navigate("")}>All dates</Button>
    </div>
    <p className="caption" role="status">{pending ? "Loading sessions…" : selected ? "Date changes apply immediately." : "Showing all upcoming dates."}</p>
  </div>;
}
