import { notFound } from "next/navigation";
import { Badge, ButtonLink, Card, PageTitle } from "@/shared/ui/components";
import { AppointmentCard, QuickActions } from "@/shared/ui/care-components";
import { QueuePreview } from "@/shared/ui/queue-ticket";
import { BookingPreview } from "@/shared/ui/booking-preview";
import { RequestTable } from "@/shared/ui/admin-request-panel";
import { QueueConsolePreview } from "@/shared/ui/queue-console-preview";
export default async function Preview({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  const { screen } = await params;
  if (!["patient", "admin", "queue", "booking"].includes(screen)) notFound();
  return (
    <>
      <p className="notice">
        Synthetic design preview · No account, booking, or queue operation is
        performed here.
      </p>
      {screen === "patient" ? (
        <>
          <PageTitle
            eyebrow="PATIENT PORTAL · SAMPLE"
            title="Welcome, Sample Patient."
          >
            A little clarity for the day ahead.
          </PageTitle>
          <div className="grid-two">
            <AppointmentCard
              sample
              reference="DEMO-0042"
              service="Immunizations"
              startsAt="2026-10-21T01:00:00Z"
              status="scheduled"
            />
            <QuickActions />
          </div>
          <div className="section-heading">
            <h2>Your recent activity</h2>
            <ButtonLink href="/preview/booking" secondary>
              Try sample booking
            </ButtonLink>
          </div>
          <Card>
            <div className="activity-row">
              <span className="activity-dot" />
              <div>
                <strong>Your appointment is scheduled</strong>
                <p>Immunizations · 21 October 2026</p>
              </div>
              <Badge>Sample</Badge>
            </div>
            <div className="activity-row">
              <span className="activity-dot" />
              <div>
                <strong>Visit completed</strong>
                <p>Screening services · 12 October 2026</p>
              </div>
              <Badge>Sample</Badge>
            </div>
          </Card>
        </>
      ) : screen === "booking" ? (
        <>
          <PageTitle
            eyebrow="BOOK A VISIT · SAMPLE"
            title="Let’s plan your next visit."
          >
            Explore the booking flow with synthetic sessions.
          </PageTitle>
          <BookingPreview />
        </>
      ) : screen === "queue" ? (
        <>
          <PageTitle
            eyebrow="YOUR VISIT · SAMPLE"
            title="One less thing to wonder about."
          >
            Your ticket and next steps, at a glance.
          </PageTitle>
          <QueuePreview />
        </>
      ) : (
        <>
          <PageTitle
            eyebrow="STAFF WORKSPACE · SAMPLE"
            title="Today at the center"
          >
            21 October 2026 · Synthetic operational data
          </PageTitle>
          <div className="grid-two">
            <div className="stack">
              <RequestTable
                requests={[1, 2, 3].map((i) => ({
                  id: `sample-${i}`,
                  public_reference: `DEMO-00${41 + i}`,
                  status: "pending",
                }))}
              />
              <ButtonLink href="/admin" secondary>
                Go to secure staff workspace
              </ButtonLink>
            </div>
            <QueueConsolePreview />
          </div>
        </>
      )}
    </>
  );
}

