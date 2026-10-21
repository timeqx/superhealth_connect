"use client";
import { useState } from "react";
import type { Slot } from "../domain/appointment";
import { formatDate, formatTime, manilaDate } from "@/shared/lib/time";
import { book } from "@/server/actions";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Card } from "@/shared/ui/components";
import { BookingStepper } from "@/shared/ui/care-components";
import { CalendarDays, ShieldCheck } from "lucide-react";
export function SlotPicker({
  slots,
  value,
  onChange,
  asOf,
}: {
  slots: Slot[];
  value: string;
  onChange: (id: string) => void;
  asOf: string;
}) {
  const dates = [...new Set(slots.map((s) => manilaDate(s.starts_at)))].sort();
  const [date, setDate] = useState(() => {
    const selected = slots.find((s) => s.id === value);
    return selected ? manilaDate(selected.starts_at) : dates[0] || "";
  });
  const sessions = slots.filter((s) => manilaDate(s.starts_at) === date);
  return (
    <div className="stack">
      <label className="field">
        Visit date · Philippine time
        <Input
          type="date"
          value={date}
          min={dates[0]}
          max={dates.at(-1)}
          disabled={!dates.length}
          onChange={(e) => {
            setDate(e.target.value);
            onChange("");
          }}
        />
      </label>
      <p className="caption">
        Choose a date to see published sessions. Dates with no sessions are
        unavailable.
      </p>
      <fieldset className="slot-list">
        <legend>Available sessions</legend>
        {sessions.map((s) => {
          const unavailable =
            s.remaining <= 0 || Date.parse(s.starts_at) <= Date.parse(asOf);
          return (
            <label className="slot-option" key={s.id}>
              <input
                type="radio"
                name="session"
                value={s.id}
                checked={value === s.id}
                disabled={unavailable}
                onChange={() => onChange(s.id)}
                required
              />
              <span>
                <strong>
                  {formatTime(s.starts_at)}–{formatTime(s.ends_at)}
                </strong>
                <small>
                  {s.remaining <= 0
                    ? "Full · no spaces available"
                    : unavailable
                      ? "Unavailable · session has started"
                      : `${s.remaining} spaces available`}
                </small>
              </span>
            </label>
          );
        })}
        {!sessions.length && (
          <p className="notice">
            No sessions available on this date. Choose another date or service.
          </p>
        )}
      </fieldset>
    </div>
  );
}
export function BookingForm({
  slots,
  service,
  asOf,
  demo = false,
}: {
  slots: Slot[];
  service: string;
  asOf: string;
  demo?: boolean;
}) {
  const [slot, setSlot] = useState("");
  const [review, setReview] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [key, setKey] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const selected = slots.find((s) => s.id === slot);
  if (submitted)
    return (
      <Card>
        <ShieldCheck className="text-primary" size={32} />
        <p className="eyebrow">SYNTHETIC RECEIPT</p>
        <h2>Request submitted for review</h2>
        <p>
          This demo request is pending approval. It is not a scheduled
          appointment or queue ticket. Nothing was saved.
        </p>
        <p>
          {service} · {selected && formatDate(selected.starts_at)}
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setSubmitted(false);
            setReview(false);
          }}
        >
          Back to sample booking
        </Button>
      </Card>
    );
  return (
    <div className="stack">
      <BookingStepper step={review ? 3 : 2} />
      <div className="booking-layout">
        <Card>
          <form
            className="form"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!selected || selected.remaining <= 0) return;
              if (!demo && Date.parse(selected.starts_at) <= Date.parse(asOf)) {
                setMessage(
                  "This session has started. Please choose another session.",
                );
                return;
              }
              if (!review) {
                setReview(true);
                return;
              }
              if (demo) {
                setSubmitted(true);
                return;
              }
              setPending(true);
              const retryKey = key || crypto.randomUUID();
              setKey(retryKey);
              try {
                const result = await book({ slotId: slot, key: retryKey });
                setMessage(result.message);
                if (result.redirectTo)
                  window.location.assign(result.redirectTo);
              } catch {
                setMessage(
                  "The connection was interrupted. Retry this request to check whether it was saved.",
                );
              } finally {
                setPending(false);
              }
            }}
          >
            <h2>{review ? "One last look." : "Find a time for your visit."}</h2>
            <p>
              {review
                ? "Check your details before sending your request to the center."
                : "Choose a date and an available session. All times are Philippine time."}
            </p>
            {!review ? (
              <SlotPicker
                slots={slots}
                value={slot}
                asOf={asOf}
                onChange={(id) => {
                  setSlot(id);
                  setKey("");
                  setMessage("");
                }}
              />
            ) : (
              <>
                <div className="visit-date">
                  <CalendarDays size={24} />
                  <div>
                    <strong>{service}</strong>
                    <p>
                      {selected &&
                        `${formatDate(selected.starts_at)} · ${formatTime(selected.starts_at)}`}
                    </p>
                  </div>
                </div>
                <p className="notice">
                  Submitting reserves capacity while staff reviews your request.
                  It is not a confirmed appointment or queue ticket.
                </p>
              </>
            )}
            {message && (
              <p role="status" className="notice">
                {message}
              </p>
            )}
            <div className="actions">
              <Button type="submit" disabled={pending || !selected}>
                {pending
                  ? "Submitting…"
                  : review
                    ? demo
                      ? "Submit sample request"
                      : "Submit request"
                    : "Review request"}
              </Button>
              {review && (
                <Button
                  variant="outline"
                  type="button"
                  disabled={pending}
                  onClick={() => setReview(false)}
                >
                  Change session
                </Button>
              )}
            </div>
          </form>
        </Card>
        <Card className="booking-summary" soft>
          <p className="eyebrow">YOUR VISIT SUMMARY</p>
          <h2>{service}</h2>
          <dl>
            <dt>Date</dt>
            <dd>
              {selected
                ? formatDate(selected.starts_at)
                : "Choose your visit date"}
            </dd>
            <dt>Session</dt>
            <dd>
              {selected
                ? `${formatTime(selected.starts_at)}–${formatTime(selected.ends_at)}`
                : "Select an available session"}
            </dd>
            <dt>Location</dt>
            <dd>Batasan Hills Super Health Center</dd>
          </dl>
          <p className="caption">
            Staff approval confirms your appointment. A queue ticket is issued
            only after staff check-in.
          </p>
          {demo && (
            <p className="caption">
              Synthetic preview · no reservation is made.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
