import Link from "next/link";
import { supabaseConfig } from "@/shared/supabase/config";
import { requireActor } from "@/server/session";
import { SetupNotice } from "@/shared/ui/components";
import { signOut } from "@/features/accounts/application/auth-actions";
export const dynamic = "force-dynamic";
export default async function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!supabaseConfig()) return <SetupNotice />;
  await requireActor();
  return (
    <>
      <nav className="subnav" aria-label="Patient navigation">
        <Link href="/patient">Home</Link>
        <Link href="/patient/appointments">Appointments</Link>
        <Link href="/patient/inquiries">Inquiries</Link>
        <Link href="/patient/profile">Profile</Link>
        <form action={signOut}>
          <button className="button secondary">Sign out</button>
        </form>
      </nav>
      {children}
    </>
  );
}
