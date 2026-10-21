"use client";
import { useState } from "react";
import { Button } from "./button";
import { Card } from "./components";
import { AppointmentStatusBadge } from "./care-components";
export function QueueConsolePreview() {
  const [state, setState] = useState<
    "waiting" | "called" | "in_service" | "completed"
  >("waiting");
  return (
    <Card soft>
      <p className="eyebrow">SYNTHETIC QUEUE CONSOLE</p>
      <h2>Immunizations · Desk 1</h2>
      <AppointmentStatusBadge status={state} />
      <strong className="ticket">Q-023</strong>
      <p aria-live="polite">
        {state === "waiting"
          ? "One sample ticket is ready to be called."
          : state === "called"
            ? "Q-023 has been called to Desk 1."
            : state === "in_service"
              ? "Q-023 is being assisted."
              : "The sample visit is completed."}
      </p>
      <Button
        disabled={state === "completed"}
        onClick={() =>
          setState(
            state === "waiting"
              ? "called"
              : state === "called"
                ? "in_service"
                : "completed",
          )
        }
      >
        {state === "waiting"
          ? "Call next · sample"
          : state === "called"
            ? "Start service · sample"
            : state === "in_service"
              ? "Complete visit · sample"
              : "Visit completed"}
      </Button>
      {state !== "waiting" && (
        <Button variant="outline" onClick={() => setState("waiting")}>
          Reset demonstration
        </Button>
      )}
      <p className="caption">
        Local visual demonstration only. No real queue is changed.
      </p>
    </Card>
  );
}
