import { getActor } from "@/server/session";
import { reportRange } from "@/features/operations/report-range";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const actor = await getActor();
    if (!actor) return new Response("Sign in to export reports.", { status: 401, headers });
    if (actor.role !== "admin") return new Response("Staff access required.", { status: 403, headers });
    const params = new URL(request.url).searchParams;
    const from = params.get("from") ?? "", to = params.get("to") ?? "";
    const range = reportRange(from, to);
    if (!range) return new Response("Choose valid Manila dates spanning at most 93 days.", { status: 400, headers });
    const states = ["pending", "scheduled", "checked_in", "in_service", "completed", "cancelled", "rejected", "no_show"];
    const results = await Promise.all(states.map(status => actor.client.from("appointments").select("id", { count: "exact", head: true }).eq("status", status).gte("requested_at", range.start).lt("requested_at", range.end)));
    if (results.some(r => r.error)) throw new Error("REPORT_UNAVAILABLE");
    const total = results.reduce((n, r) => n + (r.count ?? 0), 0);
    const rows = [["from_manila", "through_manila", "cohort", "current_status", "requests", "total_requests"], ...states.map((s, i) => [from, to, "request_submission_date", s, String(results[i].count ?? 0), String(total)])];
    const csv = rows.map(row => row.map(cell => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    return new Response(csv, { headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="request-outcomes-${from}-${to}.csv"` } });
  } catch { return new Response("The report could not be exported. Please retry.", { status: 503, headers }); }
}
