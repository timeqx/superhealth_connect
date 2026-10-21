"use client";
import { useState } from "react";
import { sampleCatalog } from "@/features/services/domain/catalog";
import { BookingForm } from "@/features/appointments/presentation/booking-form";
import { BookingStepper, ServiceCard } from "./care-components";
import { Button } from "./button";
const slots = [
  {
    id: "sample-morning",
    starts_at: "2026-11-04T01:00:00Z",
    ends_at: "2026-11-04T01:30:00Z",
    remaining: 4,
  },
  {
    id: "sample-full",
    starts_at: "2026-11-04T02:00:00Z",
    ends_at: "2026-11-04T02:30:00Z",
    remaining: 0,
  },
  {
    id: "sample-afternoon",
    starts_at: "2026-11-04T05:00:00Z",
    ends_at: "2026-11-04T05:30:00Z",
    remaining: 2,
  },
  {
    id: "sample-tomorrow",
    starts_at: "2026-11-05T01:00:00Z",
    ends_at: "2026-11-05T01:30:00Z",
    remaining: 3,
  },
];
export function BookingPreview() {
  const [service, setService] = useState("");
  if (service)
    return (
      <div className="stack">
        <BookingForm
          service={service}
          slots={slots}
          asOf="2026-11-01T00:00:00Z"
          demo
        />
        <div>
          <Button variant="outline" onClick={() => setService("")}>
            Change service
          </Button>
        </div>
      </div>
    );
  return (
    <>
      <BookingStepper step={1} />
      <div className="grid-three">
        {sampleCatalog.map((s, i) => (
          <ServiceCard
            key={s.id}
            name={s.name}
            description={s.description}
            index={i}
          >
            <Button variant="outline" onClick={() => setService(s.name)}>
              Choose service<span className="sr-only"> {s.name}</span>
            </Button>
          </ServiceCard>
        ))}
      </div>
    </>
  );
}
