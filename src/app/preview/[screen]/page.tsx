import { notFound } from "next/navigation";
import { Badge, ButtonLink, Card, PageTitle } from "@/shared/ui/components";
export default async function Preview({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  const { screen } = await params;
  if (!["patient", "admin", "queue"].includes(screen)) notFound();
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
            Your appointments and updates, together in one place.
          </PageTitle>
          <div className="grid-two">
            <Card>
              <Badge>SCHEDULED · SAMPLE</Badge>
              <h2>Immunizations</h2>
              <p>Wednesday, 21 October 2026 · 9:00–9:30 AM</p>
              <div className="row">
                <p>Appointment</p>
                <strong>DEMO-0042</strong>
              </div>
              <div className="row">
                <p>Location</p>
                <strong>Batasan Hills Super Health Center</strong>
              </div>
              <p>
                Please arrive before your session and check in with the front
                desk.
              </p>
            </Card>
            <Card soft>
              <h2>Need another visit?</h2>
              <p>Find a service and request a time that works for you.</p>
              <ButtonLink href="/services">Explore services</ButtonLink>
            </Card>
          </div>
          <h2>Recent activity</h2>
          <Card>
            <div className="row">
              <p>21 Oct · Immunizations</p>
              <strong>Scheduled · sample</strong>
            </div>
            <div className="row">
              <p>12 Oct · Screening services</p>
              <strong>Completed · sample</strong>
            </div>
          </Card>
        </>
      ) : screen === "admin" ? (
        <>
          <PageTitle
            eyebrow="STAFF WORKSPACE · SAMPLE"
            title="Today at the center"
          >
            20 October 2026 · Synthetic operational data
          </PageTitle>
          <div className="metrics">
            {[
              ["Pending requests", "12"],
              ["Scheduled today", "28"],
              ["In queue", "08"],
              ["Completed", "16"],
            ].map(([label, value]) => (
              <Card key={label}>
                <p>{label}</p>
                <strong className="metric">{value}</strong>
              </Card>
            ))}
          </div>
          <div className="grid-two">
            <Card>
              <h2>Appointment requests</h2>
              {["Sample Patient A", "Sample Patient B", "Sample Patient C"].map(
                (name) => (
                  <div className="row" key={name}>
                    <p>{name}</p>
                    <strong>Immunizations · 21 Oct</strong>
                  </div>
                ),
              )}
              <ButtonLink href="/admin" secondary>
                Go to secure staff workspace
              </ButtonLink>
            </Card>
            <Card soft>
              <Badge>SAMPLE QUEUE</Badge>
              <p>Now serving</p>
              <strong className="ticket">Q-020</strong>
              <p>Immunizations · Desk 1</p>
              <p>Call the next checked-in patient when the desk is ready.</p>
            </Card>
          </div>
        </>
      ) : (
        <div className="narrow stack">
          <PageTitle eyebrow="YOUR VISIT · SAMPLE" title="You’re in the queue.">
            Immunizations · Desk 1
          </PageTitle>
          <Card soft>
            <Badge>WAITING · SAMPLE</Badge>
            <p className="eyebrow">YOUR TICKET</p>
            <strong className="ticket">Q-023</strong>
            <h3>2 people ahead of you</h3>
            <p>Static sample · not live data</p>
          </Card>
          <p>
            Tickets are issued only after staff confirms arrival. A booking
            reference is not a queue ticket.
          </p>
          <ButtonLink href="/preview/patient" secondary>
            Back to patient preview
          </ButtonLink>
        </div>
      )}
    </>
  );
}
