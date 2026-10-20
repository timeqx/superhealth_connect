import Link from "next/link";
import { ArrowRight, CalendarDays, ClipboardCheck, MapPin, ShieldCheck, Ticket } from "lucide-react";
import { ButtonLink } from "@/shared/ui/components";
import { ServiceCard, VisitPreview } from "@/shared/ui/care-components";
export default function Home() {
  return <>
    <section className="hero">
      <div className="hero-copy">
        <span className="location-label"><span />BATASAN HILLS SUPER HEALTH CENTER</span>
        <h1>Your next step to<br /><em>better health.</em></h1>
        <p>A little less waiting. A little more peace of mind. Request a visit and keep your care connected, from home to the center.</p>
        <div className="actions"><ButtonLink href="/patient/book">Book an appointment <ArrowRight size={18} /></ButtonLink><ButtonLink href="/services" secondary>Explore services</ButtonLink></div>
        <div className="hero-note"><ShieldCheck size={18} /><span>Private account. Clear updates. Care closer to home.</span></div>
      </div>
      <VisitPreview />
    </section>
    <section className="services-section stack">
      <div className="section-heading"><div><p className="eyebrow">HERE FOR YOU, AT EVERY STAGE</p><h2>Everyday care. Thoughtfully connected.</h2></div><Link className="text-link" href="/services">View all services <ArrowRight size={17} /></Link></div>
      <div className="grid-three">
        {[["Maternal & child care", "Support for mothers, little ones, and growing families."], ["Immunizations", "Plan ahead for available vaccination services."], ["Screening services", "Take the next step toward understanding your health."]].map(([name, description], i) => <ServiceCard key={name} name={name} description={description} index={[0,4,6][i]}><Link className="text-link" href="/services">Explore service <ArrowRight size={16} /></Link></ServiceCard>)}
      </div>
      <p className="caption">Proposed services. Availability and requirements are subject to center confirmation.</p>
    </section>
    <section className="how-section"><div><p className="eyebrow">FROM YOUR SCREEN TO YOUR VISIT</p><h2>A clearer path<br />to your care.</h2><p>Three simple steps, with updates along the way.</p></div><ol className="journey-list">
      {[{ Icon: CalendarDays, title: "Find a session", text: "Choose a service and request an available date and time." }, { Icon: ClipboardCheck, title: "Wait for staff approval", text: "Your request stays pending until the center confirms it." }, { Icon: Ticket, title: "Check in at the center", text: "Staff confirms your arrival and issues your queue ticket." }].map(({Icon, title, text}, i) => <li key={title}><span className="journey-number">0{i+1}</span><Icon size={23} /><div><h3>{title}</h3><p>{text}</p></div></li>)}
    </ol></section>
    <section className="center-panel"><span className="icon-tile"><MapPin size={24} /></span><div><p className="eyebrow">YOUR COMMUNITY HEALTH CENTER</p><h2>Batasan Hills, Quezon City</h2><p>Visit details, service hours, and contact information will be published once confirmed by the center.</p></div><ButtonLink href="/patient/inquiries" secondary>Ask about your visit <ArrowRight size={16} /></ButtonLink></section>
  </>;
}
