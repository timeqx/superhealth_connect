import { requireActor } from "@/server/session";
import { Badge, ButtonLink, Card, PageTitle } from "@/shared/ui/components";
export default async function PatientHome() {
  const { profile } = await requireActor();
  return (
    <>
      <PageTitle
        eyebrow="PATIENT PORTAL"
        title={`Welcome${profile.first_name ? `, ${profile.first_name}` : ""}.`}
      >
        Your appointments and updates, together in one place.
      </PageTitle>
      <div className="grid-two">
        <Card>
          <Badge>{profile.review_status.toUpperCase()}</Badge>
          <h2>Your account</h2>
          <p>
            {profile.review_status === "approved"
              ? "Your account is approved. You can request an available appointment."
              : profile.review_status === "pending"
                ? "Staff are reviewing your submission. You can still send an inquiry."
                : profile.rejection_reason ||
                  "Complete your profile and verification before requesting an appointment."}
          </p>
          <ButtonLink href="/patient/profile" secondary>
            View profile
          </ButtonLink>
        </Card>
        <Card soft>
          <h2>Need a visit?</h2>
          <p>Find a service and request a time that works for you.</p>
          <ButtonLink href="/patient/book">Book an appointment</ButtonLink>
        </Card>
      </div>
      <ButtonLink href="/patient/appointments" secondary>
        View appointments and queue
      </ButtonLink>
    </>
  );
}
