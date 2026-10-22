import { AuthForm } from "@/features/accounts/presentation/auth-form";
import { ButtonLink, Card, PageTitle } from "@/shared/ui/components";
import Link from "next/link";
export default async function SignIn({ searchParams }: { searchParams: Promise<{ registered?: string }> }) {
  const { registered } = await searchParams;
  return (
    <div className="sign-in-content">
      <PageTitle eyebrow="WELCOME BACK" title="Care starts here.">
        Sign in to manage your visits. Staff use the same secure sign-in.
      </PageTitle>
      {registered === "1" && <p className="notice" role="status">Registration complete. Sign in with your verified email and password. Your account remains subject to staff review.</p>}

      <AuthForm mode="sign-in" />
      <Link className="sign-in-recovery" href="/forgot-password">Forgot password?</Link>
      <Card soft className="sign-in-help">
        <h2>Here for your first visit?</h2>
        <p>Create an account and submit your verification before booking.</p>
      <ButtonLink href="/register" secondary>
        Create an account
      </ButtonLink>
      </Card>
    </div>
  );
}
