import { AuthForm } from "@/features/accounts/presentation/auth-form";
import { PageTitle } from "@/shared/ui/components";
import { AuthBackLink } from "@/shared/ui/auth-back-link";
export default function Forgot() {
  return (
    <>
      <AuthBackLink />
      <PageTitle eyebrow="ACCOUNT ACCESS" title="Reset your password" />
      <AuthForm mode="forgot" />
    </>
  );
}
