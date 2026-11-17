import type { SupabaseClient } from "@supabase/supabase-js";
import { manilaDate, manilaInputToUtc } from "@/shared/lib/time";
import type { Slot } from "./forms";

export function sessionDateRange(date: string) {
  const start = manilaInputToUtc(`${date}T00:00`);
  return { start, end: new Date(Date.parse(start) + 86400000).toISOString() };
}

export async function loadUpcomingSessions(client: SupabaseClient, asOf: string, date?: string) {
  const sessions: Slot[] = [];
  const bounds = date ? sessionDateRange(date) : null;
  for (let offset = 0; ; offset += 500) {
    let query = client.from("service_slots")
      .select("id,service_id,starts_at,ends_at,capacity,is_open,updated_at")
      .gt("ends_at", asOf).order("starts_at").order("id");
    if (bounds) query = query.gte("starts_at", bounds.start).lt("starts_at", bounds.end);
    const { data, error } = await query.range(offset, offset + 499);
    if (error) throw new Error("Upcoming sessions could not be loaded.");
    sessions.push(...data);
    if (data.length < 500) return sessions;
  }
}

export function groupServiceSessions(sessions: Slot[]) {
  const groups = new Map<string, { key: string; date: string; serviceId: string; sessions: Slot[]; capacity: number; openCount: number; startsAt: string; endsAt: string }>();
  for (const session of sessions) {
    const date = manilaDate(session.starts_at);
    const key = `${date}:${session.service_id}`;
    const group = groups.get(key) ?? { key, date, serviceId: session.service_id, sessions: [], capacity: 0, openCount: 0, startsAt: session.starts_at, endsAt: session.ends_at };
    group.sessions.push(session);
    group.capacity += session.capacity;
    group.openCount += Number(session.is_open);
    if (Date.parse(session.starts_at) < Date.parse(group.startsAt)) group.startsAt = session.starts_at;
    if (Date.parse(session.ends_at) > Date.parse(group.endsAt)) group.endsAt = session.ends_at;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key)).map(group => ({
    ...group, sessions: group.sessions.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at) || a.id.localeCompare(b.id)),
  }));
}
