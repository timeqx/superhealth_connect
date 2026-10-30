import Link from "next/link";
import { AuthForm } from "@/features/accounts/presentation/auth-form";
import { Card, PageTitle } from "@/shared/ui/components";

export default function StaffSignIn() {
  return <div className="sign-in-content">
    <PageTitle eyebrow="STAFF PORTAL" title="Welcome back, team.">
      Sign in to manage appointments, patient verification, and daily operations.
    </PageTitle>
    <AuthForm mode="sign-in" portal="staff" />
    <Link className="sign-in-recovery" href="/staff/forgot-password">Forgot password?</Link>
    <Card soft className="sign-in-help">
      <h2>Staff access only</h2>
      <p>Use the account provided by your administrator. Contact them if you need access.</p>
    </Card>
    <Link className="sign-in-recovery" href="/sign-in">Looking for care? Go to patient sign-in</Link>
  </div>;
}
