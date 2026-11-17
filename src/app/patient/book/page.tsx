import { requireActor } from "@/server/session";
import { Badge, ButtonLink, Card, PageTitle } from "@/shared/ui/components";
import { BookingForm } from "@/features/appointments/presentation/booking-form";
import { loadAvailableSlots } from "@/features/appointments/infrastructure/slot-availability";
import { BookingStepper } from "@/shared/ui/care-components";
export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const { client, profile } = await requireActor();
  const { service } = await searchParams;
  if (profile.review_status !== "approved")
    return (
      <Card>
        <h1>Account approval comes first</h1>
        <p>
          Complete verification and wait for staff approval before requesting a
          visit.
        </p>
        <ButtonLink href="/patient/profile">View your account</ButtonLink>
      </Card>
    );
  const { data: services, error } = await client
    .from("services")
    .select("*")
    .eq("is_published", true)
    .eq("is_bookable", true);
  if (error) throw error;
  const selected = services.find((s) => s.id === service);
  if (selected) {
    const { error: scheduleError } = await client.rpc("ensure_service_sessions", { p_service: selected.id });
    if (scheduleError) throw new Error("Service sessions could not be prepared.");
    const slots = await loadAvailableSlots(client, selected.id);
    return (
      <div className="stack">
        <BookingForm
          service={selected.name}
          slots={slots}
          asOf={new Date().toISOString()}
        />
        {!slots.length && (
          <p>
            No available time slots. Please choose another service or check again
            later.
          </p>
        )}
        <ButtonLink href="/patient/book" secondary>
          Back to services
        </ButtonLink>
      </div>
    );
  }
  return (
    <>
      <PageTitle eyebrow="STEP 1 OF 3" title="Choose your service" />
      <BookingStepper step={1} />
      <div className="grid-three">
        {services.map((s) => (
          <Card key={s.id}>
            <Badge>BOOKING OPEN</Badge>
            <h2>{s.name}</h2>
            <p>{s.requirements}</p>
            <ButtonLink href={`/patient/book?service=${s.id}`}>
              Choose service →
            </ButtonLink>
          </Card>
        ))}
      </div>
      {!services.length && (
        <Card>
          <h2>No sessions are open for booking</h2>
          <p>The center has not published bookable services yet.</p>
        </Card>
      )}
    </>
  );
}
