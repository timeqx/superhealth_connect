import { requireActor } from "@/server/session";
import { Badge, ButtonLink, Card, PageTitle } from "@/shared/ui/components";
import { AppointmentCard, QuickActions } from "@/shared/ui/care-components";
import type { Appointment } from "@/features/appointments/domain/appointment";
export default async function PatientHome() {
  const { profile, client, user } = await requireActor();
  const { data, error } = await client
    .from("appointments")
    .select(
      "id,public_reference,status,decision_reason,service_slots!appointments_slot_id_fkey(starts_at,services(name))",
    )
    .eq("patient_id", user.id)
    .in("status", ["pending", "scheduled", "checked_in", "in_service"])
    .order("created_at", { ascending: false });
  if (error) throw new Error("Your upcoming visits could not be loaded.");
  const appointments = (data ?? []) as unknown as Appointment[];
  const active = [...appointments].sort((a, b) => {
    const priority = (s: string) =>
      s === "in_service" ? 0 : s === "checked_in" ? 1 : 2;
    return (
      priority(a.status) - priority(b.status) ||
      (a.service_slots?.starts_at ?? "").localeCompare(
        b.service_slots?.starts_at ?? "",
      )
    );
  })[0];
  return (
    <>
      <PageTitle
        eyebrow="YOUR HEALTH, CONNECTED"
        title={`Welcome${profile.first_name ? `, ${profile.first_name}` : ""}.`}
      >
        Your next visit and the next steps, all in one place.
      </PageTitle>
      <div className="grid-two">
        <div className="stack">
          {active ? (
            <AppointmentCard
              reference={active.public_reference}
              service={active.service_slots?.services?.name || "Your visit"}
              startsAt={active.service_slots?.starts_at}
              status={active.status}
              reason={active.decision_reason}
            />
          ) : (
            <Card>
              <p className="eyebrow">YOUR NEXT VISIT</p>
              <h2>A little planning goes a long way.</h2>
              <p>
                No active appointment requests yet. When you request a visit,
                you’ll find its status here.
              </p>
              <ButtonLink href="/patient/appointments" secondary>
                View appointment history
              </ButtonLink>
            </Card>
          )}
          {active && (
            <ButtonLink href="/patient/appointments" secondary>
              View all appointments
            </ButtonLink>
          )}
        </div>
        <QuickActions />
      </div>
      <Card>
        <div className="row">
          <h3>Account & verification</h3>
          <Badge>{profile.review_status.toUpperCase()}</Badge>
        </div>
        <p>
          {profile.review_status === "approved"
            ? "Your account is ready to request appointments."
            : profile.review_status === "pending"
              ? "Staff are reviewing your submission. You can still send an inquiry."
              : profile.rejection_reason ||
                "Complete your profile and verification before requesting an appointment."}
        </p>
        <ButtonLink href="/patient/profile" secondary>
          View profile
        </ButtonLink>
      </Card>
    </>
  );
}
