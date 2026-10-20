import { AuthForm } from "@/features/accounts/presentation/auth-form";
import { PageTitle } from "@/shared/ui/components";
export default function Reset() {
  return (
    <div className="narrow stack">
      <PageTitle eyebrow="ACCOUNT ACCESS" title="Choose a new password" />
      <AuthForm mode="reset" />
    </div>
  );
}
