import {
  ArrowRight,
  CalendarDays,
  ClipboardCheck,
  MapPin,
  ShieldCheck,
  Ticket,
} from "lucide-react";
import { ButtonLink } from "@/shared/ui/components";
import { QuickActions } from "@/shared/ui/care-components";
export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="location-label">
            <span />
            BATASAN HILLS SUPER HEALTH CENTER
          </span>
          <h1>
            Your next step to
            <br />
            <em>better health.</em>
          </h1>
          <p>
            A little less waiting. A little more peace of mind. Request a visit
            and keep your care connected, from home to the center.
          </p>
          <div className="actions">
            <ButtonLink href="/patient/book">
              Book an appointment <ArrowRight size={18} />
            </ButtonLink>
            <ButtonLink href="/services" secondary>
              Explore services
            </ButtonLink>
          </div>
          <div className="hero-note">
            <ShieldCheck size={18} />
            <span>Private account. Clear updates. Care closer to home.</span>
          </div>
        </div>
        <QuickActions />
      </section>
      <section className="how-section">
        <div>
          <p className="eyebrow">FROM YOUR SCREEN TO YOUR VISIT</p>
          <h2>
            A clearer path
            <br />
            to your care.
          </h2>
          <p>Three simple steps, with updates along the way.</p>
        </div>
        <ol className="journey-list">
          {[
            {
              Icon: CalendarDays,
              title: "Find a session",
              text: "Choose a service and request an available date and time.",
            },
            {
              Icon: ClipboardCheck,
              title: "Wait for staff approval",
              text: "Your request stays pending until the center confirms it.",
            },
            {
              Icon: Ticket,
              title: "Check in at the center",
              text: "Staff confirms your arrival and issues your queue ticket.",
            },
          ].map(({ Icon, title, text }, i) => (
            <li key={title}>
              <span className="journey-number">0{i + 1}</span>
              <Icon size={23} />
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="center-panel">
        <span className="icon-tile">
          <MapPin size={24} />
        </span>
        <div>
          <p className="eyebrow">YOUR COMMUNITY HEALTH CENTER</p>
          <h2>Batasan Hills, Quezon City</h2>
          <p>
            For questions about service hours, requirements, or your visit,
            send an inquiry to the center.
          </p>
        </div>
        <ButtonLink href="/patient/inquiries" secondary>
          Ask about your visit <ArrowRight size={16} />
        </ButtonLink>
      </section>
    </>
  );
}
