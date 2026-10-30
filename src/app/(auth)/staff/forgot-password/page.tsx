import { AuthForm } from "@/features/accounts/presentation/auth-form";
import { PageTitle } from "@/shared/ui/components";
import { AuthBackLink } from "@/shared/ui/auth-back-link";

export default function StaffForgotPassword() {
  return <>
    <AuthBackLink href="/staff/sign-in" />
    <PageTitle eyebrow="STAFF ACCOUNT ACCESS" title="Reset your password" />
    <AuthForm mode="forgot" portal="staff" />
  </>;
}
