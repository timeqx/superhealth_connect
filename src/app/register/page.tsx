import { AuthForm } from "@/features/accounts/presentation/auth-form";
import { ButtonLink, PageTitle } from "@/shared/ui/components";
export default function Register() {
  return (
    <div className="narrow stack">
      <PageTitle eyebrow="GET STARTED" title="Create your account">
        Verify your email first. Then complete your name, barangay, contact
        number, and private verification submission.
      </PageTitle>
      <AuthForm mode="register" />
      <ButtonLink href="/sign-in" secondary>
        Back to sign in
      </ButtonLink>
    </div>
  );
}
