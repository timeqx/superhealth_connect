import { supabaseConfig } from "@/shared/supabase/config";
import { requireActor } from "@/server/session";
import { SetupNotice } from "@/shared/ui/components";
import { LiveUpdates } from "@/features/notifications/live-updates";
export const dynamic = "force-dynamic";
export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!supabaseConfig()) return <SetupNotice />;
  const actor = await requireActor();
  return <><LiveUpdates userId={actor.user.id} />{children}</>;
}
