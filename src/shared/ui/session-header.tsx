import { getActor } from "@/server/session";
import { supabaseConfig } from "@/shared/supabase/config";
import { AppHeader } from "./app-header";

export async function SessionHeader() {
  if (!supabaseConfig()) return <AppHeader />;
  let role: "patient" | "admin" | null = null;
  let unavailable = false;
  try {
    // Reuses the request-local actor lookup used by protected pages/layouts.
    const actor = await getActor();
    role = actor?.role ?? null;
  } catch {
    // A temporary account lookup failure must not break public pages or claim logout.
    unavailable = true;
  }
  return <AppHeader role={role} unavailable={unavailable} />;
}
