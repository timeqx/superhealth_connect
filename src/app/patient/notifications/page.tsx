import Link from "next/link";
import { requireActor } from "@/server/session";
import { Card, PageTitle } from "@/shared/ui/components";
import { formatDate, formatTime } from "@/shared/lib/time";
import { ReadButton } from "@/features/notifications/read-button";
export default async function Notifications({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { client, user } = await requireActor();
  const params = await searchParams;
  const page = Math.min(10000, Math.max(1, Number(params.page) || 1)) | 0;
  const { data, error, count } = await client.from("notifications").select("id,type,entity_type,read_at,created_at", { count: "exact" }).eq("recipient_id", user.id).order("created_at", { ascending: false }).order("id").range((page - 1) * 20, page * 20 - 1);
  if (error) throw new Error("Notifications could not be loaded.");
  return <><PageTitle eyebrow="YOUR ACCOUNT" title="Notifications">Updates about your visits, inquiries, and account.</PageTitle><div className="stack">{data.map(n => <Card key={n.id}><span className="eyebrow">{n.read_at ? "Read" : "New"}</span><h2>{n.type.replaceAll("_", " ")}</h2><p>{formatDate(n.created_at)} · {formatTime(n.created_at)}</p><p><Link href={n.entity_type === "inquiry" ? "/patient/inquiries" : n.entity_type === "appointment" || n.entity_type === "queue" ? "/patient/appointments" : "/patient/profile"}>View update →</Link></p>{!n.read_at && <ReadButton id={n.id} />}</Card>)}{!data.length && <Card><h2>You’re all caught up</h2><p>Your updates will appear here.</p></Card>}<nav aria-label="Notification pages">{page > 1 && <Link href={`?page=${page - 1}`}>Previous · </Link>}Page {page}{page * 20 < (count ?? 0) && <Link href={`?page=${page + 1}`}> · Next</Link>}</nav></div></>;
}
