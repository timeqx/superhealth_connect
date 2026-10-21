import { AuthForm } from "@/features/accounts/presentation/auth-form";
import { ButtonLink, PageTitle } from "@/shared/ui/components";
import { AuthShell } from "@/shared/ui/auth-shell";
export default function Register() {
  return (
    <AuthShell>
      <PageTitle eyebrow="GET STARTED" title="Create your account">
        Verify your email first. Then complete your name, barangay, contact
        number, and private verification submission.
      </PageTitle>
      <AuthForm mode="register" />
      <ButtonLink href="/sign-in" secondary>
        Back to sign in
      </ButtonLink>
    </AuthShell>
  );
}
