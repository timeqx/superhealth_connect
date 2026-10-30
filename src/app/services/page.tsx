import {
  type Service,
} from "@/features/services/domain/catalog";
import { supabaseConfig } from "@/shared/supabase/config";
import { serverClient } from "@/shared/supabase/server";
import { Badge, ButtonLink, Card, PageTitle } from "@/shared/ui/components";
import { ServiceCard } from "@/shared/ui/care-components";
import { formatTime } from "@/shared/lib/time";
export default async function Services() {
  const configured = Boolean(supabaseConfig());
  let services: Service[] = [];
  if (configured) {
    const { data, error } = await (await serverClient())
      .from("services")
      .select("*")
      .eq("is_published", true);
    if (error)
      throw new Error("Service information is temporarily unavailable.");
    services = data;
  }
  return (
    <>
      <PageTitle eyebrow="SERVICES" title="Care for every stage of life">
        Find a service and learn what comes next.
      </PageTitle>
      {!configured && (
        <p className="notice">
          Service information is temporarily unavailable. Please try again later.
        </p>
      )}
      <div className="grid-three">
        {services.map((s, index) => (
          <ServiceCard
            key={s.id}
            name={s.name}
            description={s.description}
            index={index}
          >
            <Badge>
              {s.is_bookable ? "BOOKING OPEN" : "TEMPORARILY UNAVAILABLE"}
            </Badge>
            <p className="caption">{s.weekdays.length ? `${s.weekdays.map(day => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]).join(", ")} · ${formatTime(`2000-01-01T${s.opening_time}+08:00`)}–${formatTime(`2000-01-01T${s.closing_time}+08:00`)}` : "No regular service days set"}</p>
            <p>{s.requirements}</p>
            {s.is_bookable && (
              <ButtonLink href={`/patient/book?service=${s.id}`}>
                Choose service →
              </ButtonLink>
            )}
          </ServiceCard>
        ))}
      </div>
      {configured && services.length === 0 && (
        <Card>
          <h2>No services published yet</h2>
          <p>
            Please check again when the center has confirmed its service
            catalog.
          </p>
        </Card>
      )}
    </>
  );
}
