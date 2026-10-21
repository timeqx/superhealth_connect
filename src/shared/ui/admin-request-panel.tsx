"use client";
import { useState, type ReactNode } from "react";
import { Search, ClipboardList } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { Card } from "./components";
import { AppointmentStatusBadge } from "./care-components";
import { AppointmentDecision } from "@/features/appointments/presentation/appointment-decision";
import { formatDate, formatTime } from "@/shared/lib/time";
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
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline">
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
  live = false,
}: {
  requests: StaffRequest[];
  live?: boolean;
}) {
  const [search, setSearch] = useState("");
  const filtered = requests.filter((r) =>
    r.public_reference.toLowerCase().includes(search.trim().toLowerCase()),
  );
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
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by reference"
          />
        </label>
        <p className="caption" role="status">
          {filtered.length} pending{" "}
          {filtered.length === 1 ? "request" : "requests"} in this list
        </p>
      </div>
      {filtered.length ? (
        <div className="table-wrap">
          <table>
            <caption className="sr-only">
              Pending appointment requests, oldest first
            </caption>
            <thead>
              <tr>
                <th scope="col">Reference</th>
                <th scope="col">Status</th>
                <th scope="col">Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.public_reference}</strong>
                  </td>
                  <td>
                    <AppointmentStatusBadge status={r.status} />
                  </td>
                  <td>
                    <AdminRequestPanel
                      title={r.public_reference}
                      description="Appointment request details"
                    >
                      <AppointmentStatusBadge status={r.status} />
                      {r.patientName && <div><p className="eyebrow">PATIENT</p><h3>{r.patientName}</h3></div>}
                      {r.serviceName && <div><p className="eyebrow">SERVICE</p><h3>{r.serviceName}</h3></div>}
                      {r.startsAt && <p>{formatDate(r.startsAt)} · {formatTime(r.startsAt)}{r.endsAt ? `–${formatTime(r.endsAt)}` : ""} · Philippine time</p>}
                      <p>
                        Staff approval is required before this appointment is
                        scheduled.
                      </p>
                      {live && r.updated_at && r.status === "pending" ? <AppointmentDecision key={`${r.id}:${r.updated_at}`} id={r.id} expected={r.updated_at} /> : <p className="notice">{live ? "This request cannot be reviewed from the current snapshot. Refresh to load its latest status." : "Synthetic preview · read-only. No appointment decision is performed here."}</p>}
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
              ? "Try another reference or clear your search."
              : "New appointment requests will appear here for staff review."}
          </p>
        </Card>
      )}
    </div>
  );
}
