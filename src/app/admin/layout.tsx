import { supabaseConfig } from "@/shared/supabase/config";
import { requireActor } from "@/server/session";
import { SetupNotice } from "@/shared/ui/components";
import Link from "next/link";
import { signOut } from "@/features/accounts/application/auth-actions";
import { Button } from "@/shared/ui/button";
export const dynamic = "force-dynamic";
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!supabaseConfig()) return <SetupNotice />;
  await requireActor(true);
  return (
    <>
      <nav className="subnav" aria-label="Staff navigation">
        <Link href="/admin">Appointment requests</Link>
        <Link href="/admin/reviews">Account reviews</Link>
        <Link href="/patient">My account</Link>
        <form action={signOut}>
          <Button variant="outline">Sign out</Button>
        </form>
      </nav>
      {children}
    </>
  );
}
