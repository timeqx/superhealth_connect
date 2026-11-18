import { getActor } from "@/server/session";
import { supabaseConfig } from "@/shared/supabase/config";
import { AppHeader } from "./app-header";
import type { UserRole } from "@/features/accounts/domain/roles";

export async function SessionHeader() {
  if (!supabaseConfig()) return <AppHeader />;
  let role: UserRole | null = null;
  let unavailable = false;
  try {
    const actor = await getActor();
    role = actor?.role ?? null;
  } catch {
    unavailable = true;
  }
  return <AppHeader role={role} unavailable={unavailable} />;
}
