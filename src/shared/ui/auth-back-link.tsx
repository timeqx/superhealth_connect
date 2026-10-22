import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function AuthBackLink() {
  return <Link href="/sign-in" className="auth-back-link" aria-label="Back to sign in" title="Back to sign in">
    <ArrowLeft size={20} aria-hidden="true" />
  </Link>;
}
