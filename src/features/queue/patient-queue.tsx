"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/shared/ui/button";
import { AppointmentStatusBadge } from "@/shared/ui/care-components";
import { formatTime } from "@/shared/lib/time";
type Snapshot = { ticket_number: number; status: string; people_ahead: number; service: string; updated_at: string; fetched_at: string };
export function PatientQueue({ id }: { id: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(true);
  const current = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    current.current?.abort();
    const controller = new AbortController(); current.current = controller;
    setPending(true);
    try {
      const response = await fetch(`/patient/queue/${id}`, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("Queue updates unavailable. Retry or check with the front desk.");
      const data = await response.json();
      if (!controller.signal.aborted) { setSnapshot(data); setError(""); }
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Updates interrupted."); }
    finally { if (!controller.signal.aborted) setPending(false); }
  }, [id]);
  useEffect(() => {
    const visibleRefresh = () => { if (document.visibilityState === "visible") void refresh(); };
    const initial = setTimeout(visibleRefresh, 0);
    const interval = setInterval(visibleRefresh, 15000);
    document.addEventListener("visibilitychange", visibleRefresh);
    window.addEventListener("online", visibleRefresh);
    return () => { clearTimeout(initial); clearInterval(interval); current.current?.abort(); document.removeEventListener("visibilitychange", visibleRefresh); window.removeEventListener("online", visibleRefresh); };
  }, [refresh]);
  return <section className="card"><h3>Your queue</h3>{snapshot && <><AppointmentStatusBadge status={snapshot.status} /><strong className="ticket">Q-{String(snapshot.ticket_number).padStart(3,"0")}</strong><p>{snapshot.service}</p>{!error && snapshot.status === "waiting" && <p>{snapshot.people_ahead} people ahead</p>}{snapshot.status === "called" && <p>Please proceed to the service desk.</p>}{snapshot.status === "skipped" && <p>Please ask staff to return you to the queue.</p>}<small>Last checked {formatTime(snapshot.fetched_at)}</small></>}
    <div role="status">{error ? <p className="notice">{error} Any displayed ticket is the last known state.</p> : !snapshot ? <p>{pending ? "Loading your ticket…" : "No ticket issued yet."}</p> : null}</div>
    <p className="caption">Updates every 15 seconds while this page is visible. No exact wait-time estimate.</p><Button variant="outline" disabled={pending} onClick={() => void refresh()}>{pending ? "Refreshing…" : "Refresh queue"}</Button></section>;
}
