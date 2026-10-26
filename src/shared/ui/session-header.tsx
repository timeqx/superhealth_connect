import { getActor } from "@/server/session";
import { supabaseConfig } from "@/shared/supabase/config";
import { AppHeader } from "./app-header";

export async function SessionHeader() {
  if (!supabaseConfig()) return <AppHeader />;
  let role: "patient" | "admin" | null = null;
  let unavailable = false;
  try {
    const actor = await getActor();
    role = actor?.role ?? null;
  } catch {
    unavailable = true;
  }
  return <AppHeader role={role} unavailable={unavailable} />;
}
