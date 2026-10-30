import { AuthForm } from "@/features/accounts/presentation/auth-form";
import { ButtonLink, Card, PageTitle } from "@/shared/ui/components";
import Link from "next/link";
export default async function SignIn({ searchParams }: { searchParams: Promise<{ registered?: string }> }) {
  const { registered } = await searchParams;
  return (
    <div className="sign-in-content">
      <PageTitle eyebrow="PATIENT PORTAL" title="Care starts here.">
        Sign in to manage your visits, appointments, and account.
      </PageTitle>
      {registered === "1" && <p className="notice" role="status">Registration complete. Sign in with your verified email and password. You can request appointments after staff approves your QC ID.</p>}

      <AuthForm mode="sign-in" />
      <Link className="sign-in-recovery" href="/forgot-password">Forgot password?</Link>
      <Card soft className="sign-in-help">
        <h2>Here for your first visit?</h2>
        <p>Create an account and submit your verification before booking.</p>
      <ButtonLink href="/register" secondary>
        Create an account
      </ButtonLink>
      </Card>
      <Link className="sign-in-recovery" href="/staff/sign-in">Staff member? Sign in to the staff portal</Link>
    </div>
  );
}
