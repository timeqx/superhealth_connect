import { Badge, ButtonLink, Card } from "@/shared/ui/components";
export default function Home() {
  return (
    <>
      <div className="hero">
        <div className="hero-copy">
          <Badge>BATASAN HILLS SUPER HEALTH CENTER</Badge>
          <h1>
            Your next step to
            <br />
            better health.
          </h1>
          <p>
            Book a visit, manage your appointments, and follow your queue — all
            in one place.
          </p>
          <div className="actions">
            <ButtonLink href="/patient/book">Book an appointment →</ButtonLink>
            <ButtonLink href="/services" secondary>
              Explore services
            </ButtonLink>
          </div>
          <small>Simple booking. Clear updates. Care closer to home.</small>
        </div>
        <Card soft>
          <p className="eyebrow">HOW IT WORKS</p>
          <h2>
            A little planning.
            <br />A smoother visit.
          </h2>
          <ol className="steps">
            <li>Choose your service and date</li>
            <li>Receive approval from the center</li>
            <li>Check in and follow your queue</li>
          </ol>
          <ButtonLink href="/preview/queue" secondary>
            See a sample queue
          </ButtonLink>
        </Card>
      </div>
      <h2>Care for every stage of life</h2>
      <div className="grid-three">
        {[
          [
            "Maternal & child care",
            "Support for mothers and growing families.",
          ],
          ["Immunizations", "Plan your visit for available vaccinations."],
          [
            "More health services",
            "View services and appointment requirements.",
          ],
        ].map(([title, body]) => (
          <Card key={title}>
            <Badge>PROPOSED SERVICE</Badge>
            <h3>{title}</h3>
            <p>{body}</p>
            <ButtonLink href="/services" secondary>
              Explore services →
            </ButtonLink>
          </Card>
        ))}
      </div>
    </>
  );
}
