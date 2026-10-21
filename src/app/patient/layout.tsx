import { supabaseConfig } from "@/shared/supabase/config";
import { requireActor } from "@/server/session";
import { SetupNotice } from "@/shared/ui/components";
export const dynamic = "force-dynamic";
export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!supabaseConfig()) return <SetupNotice />;
  await requireActor();
  return <>{children}</>;
}
