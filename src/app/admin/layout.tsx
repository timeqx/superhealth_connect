import { supabaseConfig } from "@/shared/supabase/config";
import { requireActor } from "@/server/session";
import { SetupNotice } from "@/shared/ui/components";
export const dynamic = "force-dynamic";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!supabaseConfig()) return <SetupNotice />;
  await requireActor(true);
  return <div className="workspace-body">{children}</div>;
}
