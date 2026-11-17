"use client";

import { useState } from "react";
import { OperationsForm, type Service } from "./forms";
import { ServiceDefinition } from "./service-definition";
import { ServiceScheduleForm, type ServiceSchedule } from "./service-schedule";

export function ServiceEditor({ service }: { service: Service & ServiceSchedule & { slug: string; description: string } }) {
  const [previewContainer, setPreviewContainer] = useState<HTMLDivElement | null>(null);
  return <div className="service-edit-layout">
    <section className="stack">
      <h3>Service details</h3>
      <ServiceDefinition key={service.updated_at} service={service} />
      <ServiceScheduleForm key={`schedule-${service.updated_at}`} service={service} previewContainer={previewContainer} />
    </section>
    <section className="stack">
      <h3>Availability & requirements</h3>
      <OperationsForm key={service.updated_at} service={service} />
      <div ref={setPreviewContainer} />
    </section>
  </div>;
}
