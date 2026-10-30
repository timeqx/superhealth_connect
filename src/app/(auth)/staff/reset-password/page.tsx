import { AuthForm } from "@/features/accounts/presentation/auth-form";
import { PageTitle } from "@/shared/ui/components";
import { AuthBackLink } from "@/shared/ui/auth-back-link";

export default function StaffResetPassword() {
  return <>
    <AuthBackLink href="/staff/sign-in" />
    <PageTitle eyebrow="STAFF ACCOUNT ACCESS" title="Choose a new password" />
    <AuthForm mode="reset" portal="staff" />
  </>;
}
