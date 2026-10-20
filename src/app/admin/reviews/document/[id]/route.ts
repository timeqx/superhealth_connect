import { NextResponse } from "next/server";
import { getActor } from "@/server/session";
import { z } from "zod";
import { supabaseConfig } from "@/shared/supabase/config";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const headers = {
    "Cache-Control": "private, no-store",
    "Referrer-Policy": "no-referrer",
  };
  if (!supabaseConfig())
    return new NextResponse("Document access is unavailable", {
      status: 503,
      headers,
    });
  const actor = await getActor();
  if (!actor || actor.role !== "admin")
    return new NextResponse("Access denied", { status: 403, headers });
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success)
    return new NextResponse("Not found", { status: 404, headers });
  const { data, error } = await actor.client
    .from("verification_documents")
    .select("storage_path")
    .eq("id", parsed.data)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data)
    return new NextResponse("Document unavailable", { status: 404, headers });
  // Signing uses the staff session and Storage RLS, never the privileged key.
  const { data: link, error: linkError } = await actor.client.storage
    .from("verification")
    .createSignedUrl(data.storage_path, 60, {
      download: "verification-document",
    });
  if (linkError || !link)
    return new NextResponse(
      "Document unavailable. Return to reviews and try again.",
      { status: 503, headers },
    );
  return new NextResponse(null, {
    status: 303,
    headers: { ...headers, Location: link.signedUrl },
  });
}
