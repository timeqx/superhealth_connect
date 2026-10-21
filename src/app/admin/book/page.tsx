import Link from "next/link";
import { requireActor } from "@/server/session";
import { PageTitle, Card } from "@/shared/ui/components";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { StaffBook } from "@/features/appointments/presentation/staff-book";
export default async function StaffBooking({ searchParams }: { searchParams: Promise<{ name?: string; service?: string }> }) {
  const { client } = await requireActor(true);
  const params = await searchParams;
  const name = (params.name ?? "").trim().slice(0, 80).replace(/[%_\\]/g, "");
  const services = await client.from("services").select("id,name").eq("is_published", true).eq("is_bookable", true).order("name");
  if (services.error) throw new Error("Services could not be loaded.");
  const service = services.data.find(s => s.id === params.service)?.id;
  const patients = name.length >= 2 ? await client.from("profiles").select("id,first_name,last_name").eq("review_status", "approved").ilike("last_name", `${name}%`).order("last_name").order("id").limit(20) : null;
  const slots = service ? await client.rpc("slot_availability", { p_service: service }) : null;
  if (patients?.error || slots?.error) throw new Error("Booking options could not be loaded.");
  return <><PageTitle eyebrow="STAFF WORKSPACE" title="Book for a patient">Confirm the patient’s identity and permission. Only active, approved patients with confirmed email can receive a booking.</PageTitle><Card><form className="stack"><label>Patient last name (at least two characters)<Input name="name" minLength={2} maxLength={80} defaultValue={name} required /></label><label>Service<select name="service" defaultValue={service} required>{services.data.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><Button type="submit">Find patient and sessions</Button></form></Card>{patients && service && <Card><p>Showing up to 20 matches. Refine the name if needed.</p><StaffBook key={`${name}:${service}`} patients={patients.data!} slots={slots?.data ?? []} /></Card>}<p><Link href="/admin">Review appointment requests →</Link></p></>;
}
