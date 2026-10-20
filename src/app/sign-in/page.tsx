import { AuthForm } from "@/features/accounts/presentation/auth-form";
import { ButtonLink, Card, PageTitle } from "@/shared/ui/components";
export default function SignIn() {
  return (
    <div className="narrow stack">
      <PageTitle eyebrow="WELCOME BACK" title="Care starts here.">
        Sign in to manage your visits. Staff use the same secure sign-in.
      </PageTitle>
      <AuthForm mode="sign-in" />
      <ButtonLink href="/register" secondary>
        Create an account
      </ButtonLink>
      <a href="/forgot-password">Forgot password?</a>
      <Card soft>
        <h2>Here for your first visit?</h2>
        <p>Create an account and submit your verification before booking.</p>
      </Card>
    </div>
  );
}
