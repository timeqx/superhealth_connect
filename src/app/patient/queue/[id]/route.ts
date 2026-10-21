import { getActor } from "@/server/session";
import { z } from "zod";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return Response.json({ error: "Invalid appointment." }, { status: 400, headers });
  try {
    const actor = await getActor();
    if (!actor) return Response.json({ error: "Sign in to see your queue." }, { status: 401, headers });
    const { data, error } = await actor.client.rpc("my_queue", { p_appointment: id });
    if (error) return Response.json({ error: "Queue unavailable. Refresh or ask the front desk." }, { status: 403, headers });
    return Response.json(data, { headers });
  } catch { return Response.json({ error: "Updates interrupted. Please try again." }, { status: 503, headers }); }
}
