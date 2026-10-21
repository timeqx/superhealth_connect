import { requireActor } from "@/server/session";
import { Card } from "@/shared/ui/components";
type Durations = { decisions: { cohort: number; samples: number; minutes: number | null }; queue: { cohort: number; wait_samples: number; wait_minutes: number | null; service_samples: number; service_minutes: number | null } };
export async function DurationReport({ start, end }: { start: string; end: string }) {
  const { client } = await requireActor(true);
  const { data, error } = await client.rpc("operational_durations", { p_start: start, p_end: end });
  if (error) return <Card><h2>Duration metrics unavailable</h2><p>Ensure the staff-management migration is installed, then refresh.</p></Card>;
  const value = data as Durations;
  const minutes = (n: number | null) => n === null ? "No completed samples" : `${Number(n).toFixed(1)} minutes`;
  return <Card><h2>Average durations</h2><dl><dt>Request to latest decision</dt><dd>{minutes(value.decisions.minutes)} · {value.decisions.samples} of {value.decisions.cohort} requests</dd><dt>Check-in to service start</dt><dd>{minutes(value.queue.wait_minutes)} · {value.queue.wait_samples} of {value.queue.cohort} checked-in visits</dd><dt>Service start to completion</dt><dd>{minutes(value.queue.service_minutes)} · {value.queue.service_samples} of {value.queue.cohort} checked-in visits</dd></dl><p className="caption">Request metrics use request-submission dates; queue metrics use check-in dates. Both use the selected Manila range. Missing or negative durations are excluded. Waiting time includes time spent skipped before service; no priority adjustment is applied. These are historical averages, not wait-time predictions.</p></Card>;
}
