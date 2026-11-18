"use client";

import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { DateField } from "@/shared/ui/date-field";
import { shiftDate, validDateOnly } from "@/shared/lib/date-field";

export function QueueDateFilter({ date, today }: { date: string; today: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useOptimistic(date);
  function navigate(value: string) {
    if (pending || !validDateOnly(value) || value === date) return;
    startTransition(() => { setSelected(value); router.replace(`/admin/queue?${new URLSearchParams({ date: value })}`, { scroll: false }); });
  }
  return <div className="queue-date-filter" aria-busy={pending}>
    <Button variant="outline" size="icon" aria-label="Previous day" title="Previous day" disabled={pending || selected === "0001-01-01"} onClick={() => navigate(shiftDate(selected, -1))}><ChevronLeft size={16} /></Button>
    <DateField aria-label="Queue date · Philippine time" value={selected} onValueChange={value => navigate(value || today)} disabled={pending} />
    <Button variant="outline" size="icon" aria-label="Next day" title="Next day" disabled={pending || selected === "9999-12-31"} onClick={() => navigate(shiftDate(selected, 1))}><ChevronRight size={16} /></Button>
    <Button variant="ghost" size="sm" disabled={pending || selected === today} onClick={() => navigate(today)}>Today</Button>
    <span className="sr-only" role="status">{pending ? "Loading queue…" : `Queue for ${selected}`}</span>
  </div>;
}
