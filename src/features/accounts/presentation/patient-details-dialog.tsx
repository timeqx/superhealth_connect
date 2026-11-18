"use client";

import { useRef, useState } from "react";
import { getPatientDetails } from "../application/patient-details";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";
import { AppointmentStatusBadge } from "@/shared/ui/care-components";
import { formatDate, formatTime } from "@/shared/lib/time";

export function PatientDetailsDialog({ patientId, name = "Patient", asName = false }: {
  patientId: string; name?: string; asName?: boolean;
}) {
  const [result, setResult] = useState<Awaited<ReturnType<typeof getPatientDetails>> | null>(null);
  const [pending, setPending] = useState(false);
  const [page, setPage] = useState(1);
  const request = useRef(0);

  async function load(nextPage: number) {
    const version = ++request.current;
    setPage(nextPage);
    setPending(true);
    setResult(null);
    try {
      const response = await getPatientDetails(patientId, nextPage);
      if (request.current === version) setResult(response);
    } catch {
      if (request.current === version) setResult({ ok: false, message: "Patient details could not be loaded. Please try again." });
    } finally {
      if (request.current === version) setPending(false);
    }
  }

  return <Sheet onOpenChange={open => {
    if (open) void load(1);
    else { request.current++; setResult(null); }
  }}>
    <SheetTrigger asChild>
      <Button type="button" variant={asName ? "link" : "outline"} className={asName ? "px-0 text-left justify-start" : undefined}>
        {asName ? name : "View patient details"}<span className="sr-only">{asName ? ": view details and appointment history" : `: ${name}`}</span>
      </Button>
    </SheetTrigger>
    <SheetContent className="detail-dialog">
      <SheetTitle>{result?.ok ? result.profile.name : name}</SheetTitle>
      <SheetDescription>Patient details and appointment history. All times are Philippine time.</SheetDescription>
      <div className="stack" aria-busy={pending}>
        {pending && <p role="status">Loading patient details…</p>}
        {result && !result.ok && <div role="alert"><p className="notice">{result.message}</p><Button variant="outline" onClick={() => void load(page)}>Try again</Button></div>}
        {result?.ok && <>
          <dl className="patient-details-grid">
            <div><dt>Phone</dt><dd>{result.profile.phone || "Not provided"}</dd></div>
            <div><dt>Barangay</dt><dd>{result.profile.barangay || "Not provided"}</dd></div>
            <div><dt>Account verification</dt><dd className="capitalize">{result.profile.reviewStatus}</dd></div>
            <div><dt>Registered</dt><dd>{formatDate(result.profile.createdAt)}</dd></div>
          </dl>
          <section className="stack" aria-label="Appointment history">
            <h3>Appointment history ({result.count})</h3>
            <p className="caption">All statuses, most recently requested first.</p>
            {!result.appointments.length && <p>No appointments found.</p>}
            {result.appointments.map(visit => <article className="card" key={visit.id}>
              <div className="row"><h4>{visit.service}</h4><AppointmentStatusBadge status={visit.status} /></div>
              <p className="caption">{visit.reference}</p>
              <p>{visit.startsAt ? `${formatDate(visit.startsAt)} · ${formatTime(visit.startsAt)}${visit.endsAt ? `–${formatTime(visit.endsAt)}` : ""}` : "Session details unavailable"}</p>
              <p className="caption">Requested {formatDate(visit.requestedAt)}</p>
              {visit.reason && <p className="notice">{visit.reason}</p>}
            </article>)}
            {result.count > 10 && <nav className="actions" aria-label="Patient appointment history pages">
              <Button variant="outline" disabled={page === 1} onClick={() => void load(page - 1)}>Previous</Button>
              <span>Page {page} of {Math.ceil(result.count / 10)}</span>
              <Button variant="outline" disabled={page * 10 >= result.count} onClick={() => void load(page + 1)}>Next</Button>
            </nav>}
          </section>
        </>}
      </div>
    </SheetContent>
  </Sheet>;
}
