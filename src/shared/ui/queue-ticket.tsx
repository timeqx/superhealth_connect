"use client";
import { useState } from "react";
import { BellRing, CircleCheck, Clock3, WifiOff } from "lucide-react";
import { Card } from "./components";
import { AppointmentStatusBadge } from "./care-components";
export type QueueState =
  | "waiting"
  | "called"
  | "in_service"
  | "completed"
  | "disconnected";
const states = {
  waiting: {
    title: "You’re in the queue.",
    text: "Please stay nearby. Staff will call your ticket when it’s your turn.",
    Icon: Clock3,
  },
  called: {
    title: "It’s your turn.",
    text: "Please proceed to Desk 1 and show your ticket to staff.",
    Icon: BellRing,
  },
  in_service: {
    title: "Your visit is underway.",
    text: "You are being assisted at Desk 1.",
    Icon: Clock3,
  },
  completed: {
    title: "You’re all done.",
    text: "Thank you for visiting. Your appointment is completed.",
    Icon: CircleCheck,
  },
  disconnected: {
    title: "Updates are disconnected.",
    text: "Your last known status was waiting. Check with the front desk for the latest queue position.",
    Icon: WifiOff,
  },
};
export function QueueTicket({
  state,
  sample = false,
}: {
  state: QueueState;
  sample?: boolean;
}) {
  const { title, text, Icon } = states[state];
  return (
    <Card className="queue-ticket">
      <div className="row">
        <span className="eyebrow">
          {sample ? "SYNTHETIC QUEUE" : "YOUR VISIT"}
        </span>
        <AppointmentStatusBadge status={state} />
      </div>
      <span className="icon-tile">
        <Icon />
      </span>
      <h2>{title}</h2>
      <p className="eyebrow">YOUR TICKET</p>
      <strong className="ticket">Q-023</strong>
      <p>Immunizations · Desk 1</p>
      <p>{text}</p>
      <div className="row">
        <strong>
          {state === "waiting"
            ? "2 people ahead"
            : state === "disconnected"
              ? "Position unavailable"
              : state === "completed"
                ? "Visit completed"
                : "Proceed to Desk 1"}
        </strong>
        <small>Sample update · 9:12 AM</small>
      </div>
      <p className="caption">
        {sample ? "Static sample · not live data" : ""} · No wait-time estimate
      </p>
    </Card>
  );
}
export function QueuePreview() {
  const [state, setState] = useState<QueueState>("waiting");
  return (
    <div className="narrow stack">
      <label className="field">
        Preview a queue state
        <select
          value={state}
          onChange={(e) => setState(e.target.value as QueueState)}
        >
          {Object.keys(states).map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <div aria-live="polite">
        <QueueTicket state={state} sample />
      </div>
      <p>
        Tickets are issued only after staff confirms arrival. A booking
        reference is not a queue ticket.
      </p>
    </div>
  );
}
