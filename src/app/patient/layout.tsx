import { supabaseConfig } from "@/shared/supabase/config";
import { requireActor } from "@/server/session";
import { SetupNotice } from "@/shared/ui/components";
import { LiveUpdates } from "@/features/notifications/live-updates";
import { needsRegistration } from "@/features/accounts/domain/registration";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!supabaseConfig()) return <SetupNotice />;
  const actor = await requireActor();
  if (actor.role === "patient" && actor.profile.review_status !== "rejected" && needsRegistration(actor.user.user_metadata)) redirect("/register");
  return <><LiveUpdates userId={actor.user.id} />{children}</>;
}
