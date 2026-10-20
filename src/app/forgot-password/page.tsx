import { AuthForm } from "@/features/accounts/presentation/auth-form";
import { PageTitle } from "@/shared/ui/components";
export default function Forgot() {
  return (
    <div className="narrow stack">
      <PageTitle eyebrow="ACCOUNT ACCESS" title="Reset your password" />
      <AuthForm mode="forgot" />
    </div>
  );
}
