"use client";
import { useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Search, ClipboardList } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { Textarea } from "./textarea";
import { Card } from "./components";
import { AppointmentStatusBadge } from "./care-components";
import { AppointmentDecision } from "@/features/appointments/presentation/appointment-decision";
import { bulkDecideAppointments } from "@/features/appointments/application/decision-actions";
import { formatDate, formatTime } from "@/shared/lib/time";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "./alert-dialog";
export type StaffRequest = {
  id: string;
  public_reference: string;
  status: string;
  updated_at?: string;
  patientName?: string;
  serviceName?: string;
  startsAt?: string;
  endsAt?: string;
};
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "./sheet";
export function AdminRequestPanel({
  title,
  description,
  children,
  disabled = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          Review<span className="sr-only"> {title}</span>
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetTitle>{title}</SheetTitle>
        <SheetDescription>{description}</SheetDescription>
        {children}
      </SheetContent>
    </Sheet>
  );
}
export function RequestTable({
  requests,
}: {
  requests: StaffRequest[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const [completed, setCompleted] = useState<Map<string, string>>(new Map());
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = useState<{ decision: "approve" | "reject"; requests: { id: string; expected: string }[] } | null>(null);
  const busy = useRef(false);
  const retryKeys = useRef(new Map<string, string>());
  const filtered = requests.filter(r => (!completed.has(r.id) || completed.get(r.id) !== r.updated_at) && r.status === "pending" &&
    [r.public_reference, r.patientName, r.serviceName].some(value => value?.toLowerCase().includes(search.trim().toLowerCase())),
  );
  const eligible = filtered.filter(r => r.updated_at);
  const chosen = eligible.filter(r => selected.get(r.id) === r.updated_at);
  const allSelected = eligible.length > 0 && chosen.length === eligible.length;

  function review(decision: "approve" | "reject") {
    if (busy.current || !chosen.length) return;
    setConfirmation({ decision, requests: chosen.map(r => ({ id: r.id, expected: r.updated_at! })) });
  }

  async function submit() {
    if (busy.current || !confirmation || (confirmation.decision === "reject" && !reason.trim())) return;
    const input = { ...confirmation, reason: reason.trim() };
    const keyedRequests = input.requests.map(request => {
      const signature = JSON.stringify({ ...request, decision: input.decision, reason: input.reason });
      let key = retryKeys.current.get(signature);
      if (!key) { key = crypto.randomUUID(); retryKeys.current.set(signature, key); }
      return { ...request, key };
    });
    busy.current = true;
    setPending(true);
    setMessage("");
    try {
      const result = await bulkDecideAppointments({ ...input, requests: keyedRequests });
      setMessage(result.message);
      setErrors(Object.fromEntries(result.results.filter(row => !row.ok).map(row => [row.id, row.message])));
      const saved = new Set(result.results.filter(row => row.ok).map(row => row.id));
      setCompleted(current => new Map([...current, ...input.requests.filter(row => saved.has(row.id)).map(row => [row.id, row.expected] as const)]));
      setSelected(current => new Map([...current].filter(([id]) => !saved.has(id))));
      if (result.ok) setReason("");
      setConfirmation(null);
      router.refresh();
    } catch {
      setMessage("Connection interrupted. Retry the same decision to confirm which requests were saved.");
      setConfirmation(null);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <div className="stack">
      <div className="table-toolbar">
        <label className="field">
          <span className="detail-line">
            <Search size={16} />
            Find a request
          </span>
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSelected(new Map()); }}
            placeholder="Reference, patient or service"
            disabled={pending}
          />
        </label>
        <p className="caption" role="status">
          {filtered.length} pending{" "}
          {filtered.length === 1 ? "request" : "requests"} in this list
        </p>
      </div>
      {!!eligible.length && <div className="request-bulk-toolbar">
        <label className="request-select-all">
          <input type="checkbox" checked={allSelected} ref={node => { if (node) node.indeterminate = chosen.length > 0 && !allSelected; }} disabled={pending} onChange={event => setSelected(event.target.checked ? new Map(eligible.map(r => [r.id, r.updated_at!])) : new Map())} />
          Select all shown
        </label>
        <p className="caption" role="status">{chosen.length} selected on this page</p>
        <div className="actions">
          <Button disabled={pending || !chosen.length} onClick={() => review("approve")}>Approve selected</Button>
          <Button variant="outline" disabled={pending || !chosen.length} onClick={() => review("reject")}>Decline selected</Button>
          {!!chosen.length && <Button variant="ghost" disabled={pending} onClick={() => setSelected(new Map())}>Clear selection</Button>}
        </div>
      </div>}
      {message && <p className="notice" role="status">{message}</p>}
      {filtered.length ? (
        <div className="table-wrap request-table" aria-busy={pending}>
          <table>
            <caption className="sr-only">
              Pending appointment requests, oldest first
            </caption>
            <thead>
              <tr>
                <th scope="col"><span className="sr-only">Select request</span></th>
                <th scope="col">Reference</th>
                <th scope="col">Patient / service</th>
                <th scope="col">Session</th>
                <th scope="col">Status</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="request-selection-cell">
                    <input type="checkbox" aria-label={`Select ${r.public_reference}`} checked={!!r.updated_at && selected.get(r.id) === r.updated_at} disabled={pending || !r.updated_at} onChange={event => setSelected(current => {
                      const next = new Map(current);
                      if (event.target.checked && r.updated_at) next.set(r.id, r.updated_at); else next.delete(r.id);
                      return next;
                    })} />
                  </td>
                  <td className="request-reference-cell">
                    <strong>{r.public_reference}</strong>
                  </td>
                  <td className="request-patient-cell"><strong>{r.patientName || "Patient"}</strong><p>{r.serviceName || "Service details in review"}</p></td>
                  <td className="request-time-cell">{r.startsAt ? <><strong>{formatDate(r.startsAt)}</strong><p>{formatTime(r.startsAt)}{r.endsAt ? `–${formatTime(r.endsAt)}` : ""}</p></> : "See details"}</td>
                  <td className="request-status-cell">
                    <AppointmentStatusBadge status={r.status} />
                    {errors[r.id] && <p className="request-error" role="status">{errors[r.id]}</p>}
                  </td>
                  <td>
                    <AdminRequestPanel
                      title={r.public_reference}
                      description="Appointment request details"
                      disabled={pending}
                    >
                      <AppointmentStatusBadge status={r.status} />
                      {r.patientName && <div><p className="eyebrow">PATIENT</p><h3>{r.patientName}</h3></div>}
                      {r.serviceName && <div><p className="eyebrow">SERVICE</p><h3>{r.serviceName}</h3></div>}
                      {r.startsAt && <p>{formatDate(r.startsAt)} · {formatTime(r.startsAt)}{r.endsAt ? `–${formatTime(r.endsAt)}` : ""} · Philippine time</p>}
                      <p>
                        Staff approval is required before this appointment is
                        scheduled.
                      </p>
                      {r.updated_at && r.status === "pending" ? <AppointmentDecision key={`${r.id}:${r.updated_at}`} id={r.id} expected={r.updated_at} /> : <p className="notice">This request cannot be reviewed from the current snapshot. Refresh to load its latest status.</p>}
                    </AdminRequestPanel>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Card>
          <ClipboardList size={28} />
          <h2>{search ? "No matching requests" : "You’re all caught up."}</h2>
          <p>
            {search
              ? "Try another reference, patient name or service, or clear your search."
              : "New appointment requests will appear here for staff review."}
          </p>
        </Card>
      )}
      <AlertDialog open={confirmation !== null} onOpenChange={open => { if (!open && !busy.current) setConfirmation(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation?.decision === "approve" ? "Approve" : "Decline"} {confirmation?.requests.length ?? 0} appointment {(confirmation?.requests.length ?? 0) === 1 ? "request" : "requests"}?</AlertDialogTitle>
            <AlertDialogDescription>{confirmation?.decision === "approve" ? "Each selected patient will see their appointment as approved. Queue tickets are issued separately at check-in." : "The selected reservations will be released. Each patient will see the reason below."} Only the selected requests on this page will be updated.</AlertDialogDescription>
          </AlertDialogHeader>
          <label className="field">{confirmation?.decision === "reject" ? "Reason for declining (required)" : "Note to patients (optional)"}<Textarea maxLength={1000} value={reason} disabled={pending} onChange={event => setReason(event.target.value)} required={confirmation?.decision === "reject"} /></label>
          <p className="caption">Requests changed by another staff member will be left unchanged and listed for review.</p>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Go back</AlertDialogCancel>
            <Button variant={confirmation?.decision === "reject" ? "destructive" : "default"} disabled={pending || !confirmation || (confirmation.decision === "reject" && !reason.trim())} onClick={() => void submit()}>{pending ? "Updating requests…" : confirmation?.decision === "approve" ? "Confirm approval" : "Confirm decline"}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
