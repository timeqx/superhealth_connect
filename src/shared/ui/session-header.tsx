import { getActor } from "@/server/session";
import { supabaseConfig } from "@/shared/supabase/config";
import { AppHeader } from "./app-header";
import type { UserRole } from "@/features/accounts/domain/roles";
import { parsePortalBadgeCounts, type PortalBadgeCounts } from "@/features/notifications/portal-badges";

export async function SessionHeader() {
  if (!supabaseConfig()) return <AppHeader />;
  let role: UserRole | null = null;
  let unavailable = false;
  let counts: PortalBadgeCounts | undefined;
  try {
    const actor = await getActor();
    role = actor?.role ?? null;
    if (actor) {
      // A failed counter query must not hide the signed-in user's navigation.
      try {
        const { data, error } = await actor.client.rpc("portal_badge_counts");
        if (!error) counts = parsePortalBadgeCounts(data);
      } catch {}
    }
  } catch {
    unavailable = true;
  }
  return <AppHeader role={role} unavailable={unavailable} counts={counts} />;
}
