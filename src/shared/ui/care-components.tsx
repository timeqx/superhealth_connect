import {
  ArrowUpRight,
  Baby,
  CalendarDays,
  Check,
  Clock3,
  HeartHandshake,
  MapPin,
  ShieldCheck,
  Stethoscope,
  Syringe,
} from "lucide-react";
import type { ReactNode } from "react";
import { Card, ButtonLink } from "./components";
import { formatDate, formatTime } from "@/shared/lib/time";
export function AppointmentStatusBadge({ status }: { status: string }) {
  const label =
    status === "pending" ? "Pending approval" : status.replaceAll("_", " ");
  return (
    <span className="status-badge" data-status={status}>
      <span aria-hidden="true" />
      {label}
    </span>
  );
}
export function ServiceCard({
  name,
  description,
  index = 0,
  children,
}: {
  name: string;
  description: string;
  index?: number;
  children?: ReactNode;
}) {
  const Icon = [
    Baby,
    HeartHandshake,
    Stethoscope,
    HeartHandshake,
    Syringe,
    ShieldCheck,
    Stethoscope,
  ][index % 7];
  return (
    <Card className={`service-card service-tone-${index % 3}`}>
      <div className="service-icon">
        <Icon size={25} strokeWidth={1.6} />
      </div>
      <h3>{name}</h3>
      <p>{description}</p>
      {children}
    </Card>
  );
}
export function AppointmentCard({
  reference,
  service,
  startsAt,
  status,
  reason,
  sample = false,
}: {
  reference: string;
  service: string;
  startsAt?: string;
  status: string;
  reason?: string | null;
  sample?: boolean;
}) {
  return (
    <Card className="appointment-card">
      <div className="row">
        <span className="eyebrow">
          {sample ? "ILLUSTRATIVE VISIT" : "YOUR APPOINTMENT"}
        </span>
        <AppointmentStatusBadge status={status} />
      </div>
      <h2>{service}</h2>
      {startsAt && (
        <div className="visit-date">
          <span className="icon-tile">
            <CalendarDays size={24} />
          </span>
          <div>
            <strong>{formatDate(startsAt)}</strong>
            <p>{formatTime(startsAt)} · Philippine time</p>
          </div>
        </div>
      )}
      <div className="detail-line">
        <MapPin size={18} />
        <span>Batasan Hills Super Health Center</span>
      </div>
      <div className="appointment-foot">
        <span>
          Reference <strong>{reference}</strong>
        </span>
        <span>{sample ? "Synthetic sample" : "Personal visit"}</span>
      </div>
      {reason && <p className="notice">{reason}</p>}
      {status === "pending" && (
        <p>
          Staff will review your request. Your appointment is not yet confirmed.
        </p>
      )}
      {status === "scheduled" && (
        <p>
          Check in with staff on arrival. Your queue ticket is issued at the
          center.
        </p>
      )}
    </Card>
  );
}
export function BookingStepper({ step }: { step: number }) {
  return (
    <ol className="booking-stepper" aria-label="Booking progress">
      {["Service", "Date & time", "Review"].map((label, i) => (
        <li
          key={label}
          aria-current={step === i + 1 ? "step" : undefined}
          data-complete={step > i + 1}
        >
          <span>{step > i + 1 ? <Check size={16} /> : i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  );
}
export function VisitPreview() {
  return (
    <div className="visit-preview">
      <div className="row preview-heading">
        <span className="eyebrow">YOUR VISIT, AT A GLANCE</span>
        <span className="sample-label">Sample</span>
      </div>
      <AppointmentCard
        sample
        reference="DEMO-0042"
        service="Immunizations"
        startsAt="2026-10-21T01:00:00Z"
        status="scheduled"
      />
      <div className="preview-queue glass-surface">
        <span className="icon-tile">
          <Clock3 size={21} />
        </span>
        <div>
          <strong>Arrive. Check in. Stay informed.</strong>
          <p>Your queue starts with staff check-in.</p>
        </div>
        <ArrowUpRight size={20} />
      </div>
    </div>
  );
}
export function QuickActions() {
  return (
    <Card soft>
      <span className="icon-tile">
        <CalendarDays />
      </span>
      <h2>Make time for your health.</h2>
      <p>Choose a service and request an available session.</p>
      <ButtonLink href="/patient/book">
        Book an appointment <ArrowUpRight size={16} />
      </ButtonLink>
      <ButtonLink href="/patient/inquiries" secondary>
        Ask a question
      </ButtonLink>
    </Card>
  );
}
