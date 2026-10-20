"use client";
import { useState } from "react";
import type { Slot } from "../domain/appointment";
import { formatDate, formatTime } from "@/shared/lib/time";
import { book } from "@/server/actions";
export function BookingForm({
  slots,
  service,
}: {
  slots: Slot[];
  service: string;
}) {
  const [slot, setSlot] = useState("");
  const [review, setReview] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [key, setKey] = useState("");
  const selected = slots.find((s) => s.id === slot);
  return (
    <form
      className="form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!review) {
          setReview(true);
          return;
        }
        setPending(true);
        const retryKey = key || crypto.randomUUID();
        setKey(retryKey);
        try {
          const result = await book({ slotId: slot, key: retryKey });
          setMessage(result.message);
          if (result.redirectTo) window.location.assign(result.redirectTo);
        } finally {
          setPending(false);
        }
      }}
    >
      <p className="eyebrow">STEP {review ? "3" : "2"} OF 3</p>
      <h2>{review ? "Review your request" : "Choose your visit"}</h2>
      <p>{service}</p>
      {!review ? (
        <label className="field">
          Available sessions · Philippine time
          <select
            required
            value={slot}
            onChange={(e) => {
              setSlot(e.target.value);
              setKey("");
              setMessage("");
            }}
          >
            <option value="">Choose a session</option>
            {slots.map((s) => (
              <option key={s.id} value={s.id} disabled={s.remaining <= 0}>
                {formatDate(s.starts_at)} · {formatTime(s.starts_at)}–
                {formatTime(s.ends_at)} · {s.remaining} remaining
              </option>
            ))}
          </select>
        </label>
      ) : (
        <>
          <p>
            {selected &&
              `${formatDate(selected.starts_at)} · ${formatTime(selected.starts_at)}–${formatTime(selected.ends_at)}`}
          </p>
          <p className="notice">
            Submitting reserves capacity while staff reviews your request. It is
            not a confirmed appointment or queue ticket.
          </p>
        </>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <button className="button" disabled={pending || !slots.length}>
        {pending ? "Submitting…" : review ? "Submit request" : "Review request"}
      </button>
      {review && (
        <button
          className="button secondary"
          type="button"
          disabled={pending}
          onClick={() => setReview(false)}
        >
          Change session
        </button>
      )}
    </form>
  );
}
